export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { cancelAppointmentReminders, rescheduleAppointmentReminder } from "@/lib/reminder-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;
    const body = await request.json();
    const { status, notes, cancellationNote, date, startTime, endTime, serviceId } = body;

    const existing = await prisma.appointment.findFirst({
      where: { id, businessId: DEMO_BUSINESS_ID },
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

    const appointment = await prisma.appointment.update({
      where: { id },
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
        businessId: DEMO_BUSINESS_ID,
        customerId: appointment.customerId,
        date: appointment.date,
        startTime: appointment.startTime,
        service: { name: appointment.service.name },
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
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;

    const existing = await prisma.appointment.findFirst({
      where: { id, businessId: DEMO_BUSINESS_ID },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    await cancelAppointmentReminders(id);
    await prisma.appointment.delete({ where: { id } });

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
