export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { type TenantRole } from "@/lib/permissions";
import { createPendingApproval } from "@/lib/pending-approvals";
import { cancelAppointmentReminders, rescheduleAppointmentReminder } from "@/lib/reminder-service";
import { syncAppointmentToGcal, deleteAppointmentFromGcal } from "@/lib/google-calendar";

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
        service: { select: { id: true, name: true, color: true, type: true, duration: true, price: true } },
        priceListItem: { select: { id: true, name: true, category: true, durationMinutes: true, basePrice: true } },
        customer: { select: { id: true, name: true, phone: true } },
        pet: { select: { id: true, name: true, species: true, breed: true } },
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
      rescheduleAppointmentReminder({
        id: appointment.id,
        businessId: authResult.businessId,
        customerId: appointment.customerId,
        date: appointment.date,
        startTime: appointment.startTime,
        service: { name: appointment.service?.name ?? appointment.priceListItem?.name ?? "תור" },
        customer: { name: appointment.customer.name },
        pet: appointment.pet ? { name: appointment.pet.name } : null,
      }).catch((err) =>
        console.error("Failed to reschedule appointment reminder:", err)
      );
    }

    // Sync to Google Calendar (awaited — fire-and-forget kills on Vercel)
    if (status === "canceled") {
      await deleteAppointmentFromGcal(id, authResult.businessId).catch((err) =>
        console.error("Failed to delete appointment from GCal:", err)
      );
    } else {
      await syncAppointmentToGcal(id, authResult.businessId).catch((err) =>
        console.error("Failed to sync appointment to GCal:", err)
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
    const { session, businessId } = authResult;

    const membership = session.memberships.find((m) => m.businessId === businessId);
    const callerRole = (membership?.role ?? "user") as TenantRole;

    // Staff cannot delete at all
    if (callerRole === "user" || callerRole === "volunteer") {
      return NextResponse.json({ error: "אין הרשאה למחיקת פגישה" }, { status: 403 });
    }

    const { id } = params;

    const existing = await prisma.appointment.findFirst({
      where: { id, businessId },
      include: {
        customer: { select: { name: true } },
        service: { select: { name: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Manager → route to pending approval
    if (callerRole === "manager") {
      const dateStr = existing.date instanceof Date
        ? existing.date.toLocaleDateString("he-IL")
        : String(existing.date).split("T")[0];
      const approval = await createPendingApproval({
        businessId,
        requestedByUserId: session.user.id,
        action: "DELETE_APPOINTMENT",
        description: `מחיקת פגישה: ${existing.customer.name} — ${dateStr} ${existing.startTime}`,
        payload: { appointmentId: id, customerId: existing.customerId ?? "" },
      });
      return NextResponse.json(
        { pendingApproval: true, approvalId: approval.id, message: "הבקשה נשלחה לאישור הבעלים" },
        { status: 202 }
      );
    }

    // Owner → require typed confirmation header
    const confirmHeader = request.headers.get("x-confirm-action");
    if (confirmHeader !== `DELETE_APPOINTMENT_${id}`) {
      return NextResponse.json(
        { error: "נדרש אישור מפורש למחיקה", requireConfirmation: true },
        { status: 428 }
      );
    }

    await cancelAppointmentReminders(id);
    await deleteAppointmentFromGcal(id, businessId).catch((err) =>
      console.error("Failed to delete appointment from GCal:", err)
    );
    await prisma.appointment.delete({ where: { id, businessId } });

    logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.DELETE_APPOINTMENT);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete appointment:", error);
    return NextResponse.json({ error: "Failed to delete appointment" }, { status: 500 });
  }
}
