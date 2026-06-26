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
import { updateAppointment, deleteAppointment, ServiceError, type UpdateAppointmentInput } from "@/services/appointments";

const PatchAppointmentSchema = z.object({
  status: z.enum(["scheduled", "completed", "canceled"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
  cancellationNote: z.string().max(500).nullable().optional(),
  date: z.string().optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
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

    const raw = await request.json();
    const parsed = PatchAppointmentSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    let appointment;
    try {
      appointment = await updateAppointment(authResult.businessId, prisma, params.id, parsed.data as UpdateAppointmentInput);
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 400 });
      }
      throw e;
    }

    const { session } = authResult;
    const { status, date, startTime } = parsed.data;
    const action =
      status === "completed" ? ACTIVITY_ACTIONS.COMPLETE_APPOINTMENT :
      status === "canceled" ? ACTIVITY_ACTIONS.CANCEL_APPOINTMENT :
      ACTIVITY_ACTIONS.UPDATE_APPOINTMENT;
    logActivity(session.user.id, session.user.name, action);

    // ── Side effects ────────────────────────────────────────────────────────

    if (status === "canceled" || status === "completed") {
      await cancelAppointmentReminders(params.id).catch((err) =>
        console.error("Failed to cancel appointment reminders:", err)
      );
    } else if (date !== undefined || startTime !== undefined) {
      await rescheduleAppointmentReminder({
        id: appointment.id,
        businessId: authResult.businessId,
        customerId: appointment.customerId,
        date: appointment.date,
        startTime: appointment.startTime,
        service: { name: appointment.service?.name ?? appointment.priceListItem?.name ?? "תור" },
        customer: { name: appointment.customer?.name ?? "לקוח" },
        pet: appointment.pet ? { name: appointment.pet.name } : null,
      }).catch((err) => console.error("Failed to reschedule appointment reminder:", err));
    }

    if (status === "canceled") {
      await deleteAppointmentFromGcal(params.id, authResult.businessId).catch((err) =>
        console.error("Failed to delete appointment from GCal:", err)
      );
    } else {
      await syncAppointmentToGcal(params.id, authResult.businessId).catch((err) =>
        console.error("Failed to sync appointment to GCal:", err)
      );
    }

    if (status === "canceled" || status === "completed") {
      const serviceName = appointment.service?.name ?? appointment.priceListItem?.name ?? "תור";
      const petName = appointment.pet?.name ? ` (${appointment.pet.name})` : "";
      const desc = status === "canceled"
        ? `תור בוטל: ${serviceName}${petName} — ${appointment.date} ${appointment.startTime}`
        : `תור הושלם: ${serviceName}${petName} — ${appointment.date} ${appointment.startTime}`;
      prisma.timelineEvent.create({
        data: {
          type: status === "canceled" ? "APPOINTMENT_CANCELLED" : "APPOINTMENT_COMPLETED",
          description: desc,
          businessId: authResult.businessId,
          customerId: appointment.customerId,
        },
      }).catch((err) => console.error("Failed to create timeline event:", err));
    }

    return NextResponse.json(appointment);
  } catch (error) {
    console.error("Failed to update appointment:", error);
    return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 });
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

    if (callerRole === "user" || callerRole === "volunteer") {
      return NextResponse.json({ error: "אין הרשאה למחיקת פגישה" }, { status: 403 });
    }

    if (callerRole === "manager") {
      const existing = await prisma.appointment.findFirst({
        where: { id: params.id, businessId },
        include: { customer: { select: { name: true } }, service: { select: { name: true } } },
      });
      if (!existing) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
      const dateStr = existing.date instanceof Date
        ? existing.date.toLocaleDateString("he-IL")
        : String(existing.date).split("T")[0];
      const approval = await createPendingApproval({
        businessId,
        requestedByUserId: session.user.id,
        action: "DELETE_APPOINTMENT",
        description: `מחיקת פגישה: ${existing.customer?.name ?? "לקוח"} — ${dateStr} ${existing.startTime}`,
        payload: { appointmentId: params.id, customerId: existing.customerId ?? "" },
      });
      return NextResponse.json(
        { pendingApproval: true, approvalId: approval.id, message: "הבקשה נשלחה לאישור הבעלים" },
        { status: 202 }
      );
    }

    const confirmHeader = request.headers.get("x-confirm-action");
    if (confirmHeader !== `DELETE_APPOINTMENT_${params.id}`) {
      return NextResponse.json({ error: "נדרש אישור מפורש למחיקה", requireConfirmation: true }, { status: 428 });
    }

    await cancelAppointmentReminders(params.id);
    await deleteAppointmentFromGcal(params.id, businessId).catch((err) =>
      console.error("Failed to delete appointment from GCal:", err)
    );

    try {
      await deleteAppointment(businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
      }
      throw e;
    }

    logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.DELETE_APPOINTMENT);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete appointment:", error);
    return NextResponse.json({ error: "Failed to delete appointment" }, { status: 500 });
  }
}
