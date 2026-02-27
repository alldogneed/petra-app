export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const serviceId = searchParams.get("serviceId");

    if (!dateStr || !serviceId) {
      return NextResponse.json(
        { error: "date and serviceId are required" },
        { status: 400 }
      );
    }

    // Get the service for duration
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      return NextResponse.json({ error: "שירות לא נמצא" }, { status: 404 });
    }

    const date = new Date(dateStr);
    const dayOfWeek = date.getDay(); // 0=Sunday

    // Get availability rule for this day
    const rule = await prisma.availabilityRule.findUnique({
      where: {
        businessId_dayOfWeek: {
          businessId: DEMO_BUSINESS_ID,
          dayOfWeek,
        },
      },
    });

    // Default hours if no rule
    const isOpen = rule ? rule.isOpen : dayOfWeek !== 6;
    const openTime = rule?.openTime || "09:00";
    const closeTime = rule?.closeTime || "18:00";

    if (!isOpen) {
      return NextResponse.json([]);
    }

    // Get existing bookings and appointments for this date
    const startOfDay = new Date(dateStr);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateStr);
    endOfDay.setHours(23, 59, 59, 999);

    const [existingBookings, existingAppointments] = await Promise.all([
      prisma.booking.findMany({
        where: {
          businessId: DEMO_BUSINESS_ID,
          startAt: { gte: startOfDay, lte: endOfDay },
          status: { in: ["pending", "confirmed"] },
        },
      }),
      prisma.appointment.findMany({
        where: {
          businessId: DEMO_BUSINESS_ID,
          date: { gte: startOfDay, lte: endOfDay },
          status: { notIn: ["CANCELED", "canceled"] },
        },
      }),
    ]);

    // Generate time slots (every 30 min)
    const [openH, openM] = openTime.split(":").map(Number);
    const [closeH, closeM] = closeTime.split(":").map(Number);
    const duration = service.duration || 60;
    const slots: Array<{ time: string; available: boolean }> = [];

    for (let h = openH; h <= closeH; h++) {
      for (const m of [0, 30]) {
        if (h === openH && m < openM) continue;
        const endMinutes = h * 60 + m + duration;
        if (endMinutes > closeH * 60 + closeM) continue;

        const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        const slotStart = new Date(dateStr);
        slotStart.setHours(h, m, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);

        // Check conflicts with bookings
        const hasBookingConflict = existingBookings.some((b) => {
          const bStart = new Date(b.startAt);
          const bEnd = new Date(b.endAt);
          return slotStart < bEnd && slotEnd > bStart;
        });

        // Check conflicts with appointments
        const hasAppointmentConflict = existingAppointments.some((a) => {
          const [aH, aM] = a.startTime.split(":").map(Number);
          const [eH, eM] = a.endTime.split(":").map(Number);
          const aStart = new Date(dateStr);
          aStart.setHours(aH, aM, 0, 0);
          const aEnd = new Date(dateStr);
          aEnd.setHours(eH, eM, 0, 0);
          return slotStart < aEnd && slotEnd > aStart;
        });

        slots.push({
          time: timeStr,
          available: !hasBookingConflict && !hasAppointmentConflict,
        });
      }
    }

    return NextResponse.json(slots);
  } catch (error) {
    console.error("GET slots error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת משבצות" }, { status: 500 });
  }
}
