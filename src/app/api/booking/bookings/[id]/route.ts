export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { enqueueSyncJob } from "@/lib/sync-jobs";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    // Validate status
    const VALID_STATUSES = ["pending", "confirmed", "declined", "cancelled"];
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `סטטוס לא תקין. ערכים אפשריים: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify booking belongs to this business before updating
    const existing = await prisma.booking.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "הזמנה לא נמצאה" }, { status: 404 });
    }

    const booking = await prisma.booking.update({
      where: { id: params.id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      include: {
        service: true,
        priceListItem: true,
        customer: true,
        dogs: { include: { pet: { select: { id: true } } } },
      },
    });

    // Auto-create linked record when booking is confirmed
    if (body.status === "confirmed") {
      const startAt = new Date(booking.startAt);
      const endAt = new Date(booking.endAt);
      const firstPetId = booking.dogs[0]?.pet?.id ?? null;

      const serviceType = booking.service?.type ?? "service";

      if (serviceType === "boarding") {
        // For boarding: create a BoardingStay linked to this booking (idempotent)
        const existingStay = await prisma.boardingStay.findUnique({
          where: { bookingId: booking.id },
        });
        if (!existingStay && firstPetId) {
          await prisma.boardingStay.create({
            data: {
              businessId: booking.businessId,
              customerId: booking.customerId,
              petId: firstPetId,
              checkIn: startAt,
              checkOut: endAt,
              status: "reserved",
              bookingId: booking.id,
            },
          });
        }
      } else if (booking.serviceId) {
        // For service-based bookings: create an Appointment
        const pad = (n: number) => n.toString().padStart(2, "0");
        const startTime = `${pad(startAt.getHours())}:${pad(startAt.getMinutes())}`;
        const endTime = `${pad(endAt.getHours())}:${pad(endAt.getMinutes())}`;
        const dateOnly = new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate());

        const existing = await prisma.appointment.findFirst({
          where: {
            businessId: booking.businessId,
            customerId: booking.customerId,
            serviceId: booking.serviceId,
            date: dateOnly,
            startTime,
          },
        });

        if (!existing) {
          await prisma.appointment.create({
            data: {
              businessId: booking.businessId,
              customerId: booking.customerId,
              serviceId: booking.serviceId,
              petId: firstPetId,
              date: dateOnly,
              startTime,
              endTime,
              status: "scheduled",
              notes: booking.notes,
            },
          });
        }
      }
      // priceListItem-based bookings: appointment creation skipped (serviceId required on Appointment)
    }

    // Enqueue Google Calendar sync based on status change
    if (body.status) {
      const action = body.status === "cancelled" ? "delete" : "update";
      enqueueSyncJob(booking.id, booking.businessId, action).catch((err) =>
        console.error("Failed to enqueue sync job:", err)
      );
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error("PATCH booking error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון הזמנה" }, { status: 500 });
  }
}
