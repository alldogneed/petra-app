/**
 * Side effects for appointments that a training-package meeting created / moved /
 * completed / canceled (CLAUDE.md rule #45). Same reminders + Google Calendar handling
 * as the appointment routes — the appointment owns them, never the meeting.
 * Every function is non-throwing.
 */
import prisma from "@/lib/prisma";
import {
  scheduleAppointmentReminder,
  scheduleAppointmentFollowup,
  rescheduleAppointmentReminder,
  cancelAppointmentReminders,
  cancelAppointmentPreReminder,
} from "@/lib/reminder-service";
import { syncAppointmentToGcal, deleteAppointmentFromGcal } from "@/lib/google-calendar";

async function loadForReminder(businessId: string, appointmentId: string) {
  const a = await prisma.appointment.findFirst({
    where: { id: appointmentId, businessId },
    select: {
      id: true, businessId: true, customerId: true, date: true, startTime: true,
      service: { select: { name: true } },
      priceListItem: { select: { name: true } },
      customer: { select: { name: true } },
      pet: { select: { name: true } },
    },
  });
  if (!a) return null;
  return {
    id: a.id,
    businessId: a.businessId,
    customerId: a.customerId,
    date: a.date,
    startTime: a.startTime,
    service: { name: a.service?.name ?? a.priceListItem?.name ?? "מפגש אילוף" },
    customer: { name: a.customer?.name ?? "לקוח" },
    pet: a.pet ? { name: a.pet.name } : null,
  };
}

function log(what: string) {
  return (err: unknown) => console.error(`[training-appointment] ${what} failed (non-critical):`, err);
}

export async function afterLinkedAppointmentCreated(businessId: string, appointmentId: string): Promise<void> {
  const a = await loadForReminder(businessId, appointmentId).catch(() => null);
  if (!a) return;
  await scheduleAppointmentReminder(a).catch(log("reminder"));
  await scheduleAppointmentFollowup(a).catch(log("follow-up"));
  await syncAppointmentToGcal(appointmentId, businessId).catch(log("gcal sync"));
}

export async function afterLinkedAppointmentMoved(businessId: string, appointmentId: string): Promise<void> {
  const a = await loadForReminder(businessId, appointmentId).catch(() => null);
  if (!a) return;
  await rescheduleAppointmentReminder(a).catch(log("reminder reschedule"));
  await syncAppointmentToGcal(appointmentId, businessId).catch(log("gcal sync"));
}

export async function afterLinkedAppointmentCompleted(businessId: string, appointmentId: string): Promise<void> {
  const a = await loadForReminder(businessId, appointmentId).catch(() => null);
  if (!a) return;
  await cancelAppointmentPreReminder(appointmentId).catch(log("pre-reminder cancel"));
  await scheduleAppointmentFollowup(a, { fromCompletion: true }).catch(log("follow-up"));
  await syncAppointmentToGcal(appointmentId, businessId).catch(log("gcal sync"));
}

export async function afterLinkedAppointmentCanceled(businessId: string, appointmentId: string): Promise<void> {
  await cancelAppointmentReminders(appointmentId).catch(log("reminder cancel"));
  await deleteAppointmentFromGcal(appointmentId, businessId).catch(log("gcal delete"));
}
