export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { cancelAppointmentReminders, rescheduleAppointmentReminder } from "@/lib/reminder-service";

const PatchAppointmentSchema = z.object({
  status: z.enum(["scheduled", "completed", "canceled"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
  cancellationNote: z.string().max(500).nullable().optional(),
  date: z.string().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  serviceId: z.string().uuid().optional(),
  priceListItemId: z.string().uuid().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;
    const raw = await request.json();
    const parsed = PatchAppointmentSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }
    const { status, notes, cancellationNote, date, startTime, endTime, serviceId, priceListItemId } = parsed.data;

    const existing = await prisma.appointment.findFirst({
      where: { id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;
    if (cancellationNote !== undefined) data.cancellationNote = cancellationNote;
    if (date !== undefined) data.date = new Date(date);
    if (startTime !== undefined) data.startTime = startTime;
    if (endTime !== undefined) data.endTime = endTime;
    if (serviceId !== undefined) data.serviceId = serviceId;
    if (priceListItemId !== undefined) data.priceListItemId = priceListItemId;

    const appointment = await prisma.appointment.update({
      where: { id, businessId: authResult.businessId },
      data,
      include: {
        service: true,
        customer: true,
        pet: true,
      },
    });

    const { session } = authResult;
    const action =
      status === "completed" ? ACTIVITY_ACTIONS.COMPLETE_APPOINTMENT :
      status === "canceled" ? ACTIVITY_ACTIONS.CANCEL_APPOINTMENT :
      ACTIVITY_ACTIONS.UPDATE_APPOINTMENT;
    logActivity(session.user.id, session.user.name, action);

    // Manage scheduled reminders
    if (status === "canceled" || status === "completed") {
      cancelAppointmentReminders(id).catch((err) =>
        console.error("Failed to cancel appointment reminders:", err)
      );
    } else if (date !== undefined || startTime !== undefined) {
      // Date/time changed — reschedule reminder
      rescheduleAppointmentReminder({
        id: appointment.id,
        businessId: authResult.businessId,
        customerId: appointment.customerId,
        date: appointment.date,
        startTime: appointment.startTime,
        service: { name: appointment.service?.name ?? "תור" },
        customer: { name: appointment.customer.name },
        pet: appointment.pet ? { name: appointment.pet.name } : null,
      }).catch((err) =>
        console.error("Failed to reschedule appointment reminder:", err)
      );
    }

    return NextResponse.json(appointment);
  } catch (error) {
    console.error("Failed to update appointment:", error);
    return NextResponse.json(
      { error: "Failed to update appointment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;

    const existing = await prisma.appointment.findFirst({
      where: { id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    await cancelAppointmentReminders(id);
    await prisma.appointment.delete({ where: { id, businessId: authResult.businessId } });

    const { session } = authResult;
    logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.DELETE_APPOINTMENT);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete appointment:", error);
    return NextResponse.json(
      { error: "Failed to delete appointment" },
      { status: 500 }
    );
  }
}
