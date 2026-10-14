/**
 * Training-package meetings ↔ calendar appointments (CLAUDE.md rule #45) — DB only.
 *
 * A meeting (TrainingProgramSession) of an individual program with a customer is booked
 * as a real Appointment and linked via `TrainingProgramSession.appointmentId`. The
 * appointment owns the calendar block, the Google Calendar event and the reminders;
 * these functions keep the two rows in step. Side effects (reminders, gcal) stay in the
 * routes — see src/lib/training-appointment-effects.ts.
 */
import type { PrismaClient } from "@prisma/client";
import { ServiceError } from "./types";
import { getMaxAppointments, normalizeTier } from "@/lib/feature-flags";
import {
  isLinkableProgram,
  sessionToAppointmentTimes,
  appointmentToSessionTimes,
  nextSessionNumber,
  linkedAppointmentNotes,
  DEFAULT_TIMEZONE,
} from "@/lib/training-appointment-link";

type DbClient = PrismaClient;

/** Appointment statuses that are still "on" (Stripe-paid bookings become `confirmed`). */
const LIVE_APPT_STATUSES = ["scheduled", "confirmed"];

/** Planning content on a not-yet-held meeting — never thrown away with a canceled appointment. */
function hasPlanningContent(s: {
  summary?: string | null; rating?: number | null; practiceItems?: string | null;
  nextSessionGoals?: string | null; homeworkForCustomer?: string | null; trainerName?: string | null;
}): boolean {
  return !!(s.summary || s.rating || s.practiceItems || s.nextSessionGoals || s.homeworkForCustomer || s.trainerName);
}

async function businessTz(db: DbClient, businessId: string): Promise<string> {
  const b = await db.business.findUnique({ where: { id: businessId }, select: { timezone: true } });
  return b?.timezone || DEFAULT_TIMEZONE;
}

/** Live sessions of a program count toward the package; canceled rows don't. */
function liveCount(sessions: { status: string }[]): number {
  return sessions.filter((s) => s.status !== "CANCELED").length;
}

/**
 * Book a SCHEDULED, unlinked session of a linkable program as a calendar appointment.
 * Returns the new appointment id, or null when the session is not eligible (boarding /
 * service-dog / no customer / not SCHEDULED / already linked).
 */
export async function bookSessionAsAppointment(
  businessId: string,
  db: DbClient,
  sessionId: string
): Promise<string | null> {
  const session = await db.trainingProgramSession.findFirst({
    where: { id: sessionId, program: { businessId } },
    include: { program: { select: { id: true, name: true, trainingType: true, customerId: true, dogId: true, totalSessions: true } } },
  });
  if (!session || session.appointmentId || session.status !== "SCHEDULED") return null;
  const program = session.program;
  if (!isLinkableProgram(program) || !program.customerId) return null;

  // Free-tier appointment cap: past it the meeting stays session-only (old behaviour).
  const biz = await db.business.findUnique({ where: { id: businessId }, select: { tier: true } });
  const max = getMaxAppointments(normalizeTier(biz?.tier));
  if (max !== null && max !== undefined) {
    const count = await db.appointment.count({ where: { businessId, status: { not: "canceled" } } });
    if (count >= max) return null;
  }

  const t = sessionToAppointmentTimes(session.sessionDate, session.durationMinutes, await businessTz(db, businessId));
  const appt = await db.appointment.create({
    data: {
      businessId,
      customerId: program.customerId,
      petId: program.dogId,
      date: t.date,
      startTime: t.startTime,
      endTime: t.endTime,
      status: "scheduled",
      notes: linkedAppointmentNotes(program.name, session.sessionNumber, program.totalSessions),
    },
    select: { id: true },
  });
  // Conditional link: if a concurrent request linked it first, drop our appointment.
  const linked = await db.trainingProgramSession.updateMany({
    where: { id: session.id, appointmentId: null },
    data: { appointmentId: appt.id },
  });
  if (linked.count === 0) {
    await db.appointment.delete({ where: { id: appt.id } }).catch(() => undefined);
    return null;
  }
  return appt.id;
}

export interface AttachablePrograms {
  id: string;
  name: string;
  dogId: string;
  dogName: string;
  totalSessions: number | null;
  completedSessions: number;
  scheduledSessions: number;
  nextSessionNumber: number;
}

/** Active individual programs of a customer (optionally one dog) with meetings left. */
export async function listAttachablePrograms(
  businessId: string,
  db: DbClient,
  customerId: string,
  petId?: string | null
): Promise<AttachablePrograms[]> {
  const programs = await db.trainingProgram.findMany({
    where: {
      businessId,
      customerId,
      trainingType: "HOME",
      status: "ACTIVE",
      ...(petId ? { dogId: petId } : {}),
    },
    select: {
      id: true,
      name: true,
      dogId: true,
      totalSessions: true,
      dog: { select: { name: true } },
      sessions: { select: { sessionNumber: true, status: true } },
    },
    orderBy: { startDate: "desc" },
    take: 20,
  });
  return programs
    .filter((p) => p.totalSessions == null || liveCount(p.sessions) < p.totalSessions)
    .map((p) => ({
      id: p.id,
      name: p.name,
      dogId: p.dogId,
      dogName: p.dog?.name ?? "",
      totalSessions: p.totalSessions,
      completedSessions: p.sessions.filter((s) => s.status === "COMPLETED").length,
      scheduledSessions: p.sessions.filter((s) => s.status === "SCHEDULED").length,
      nextSessionNumber: nextSessionNumber(p.sessions),
    }));
}

/**
 * Make an existing appointment the next meeting of a program (calendar booking,
 * order-created first meeting). Validates tenant, customer and dog; refuses a full package.
 */
export async function attachAppointmentToProgram(
  businessId: string,
  db: DbClient,
  appointmentId: string,
  programId: string
): Promise<{ sessionId: string; sessionNumber: number }> {
  const [appt, program] = await Promise.all([
    db.appointment.findFirst({
      where: { id: appointmentId, businessId },
      select: { id: true, customerId: true, petId: true, date: true, startTime: true, endTime: true, status: true, trainingSession: { select: { id: true } } },
    }),
    db.trainingProgram.findFirst({
      where: { id: programId, businessId },
      select: {
        id: true, name: true, trainingType: true, customerId: true, dogId: true, status: true, totalSessions: true,
        sessions: { select: { id: true, sessionNumber: true, status: true, sessionDate: true, appointmentId: true } },
      },
    }),
  ]);
  if (!appt) throw new ServiceError("תור לא נמצא", "NOT_FOUND");
  if (!program) throw new ServiceError("תוכנית אילוף לא נמצאה", "NOT_FOUND");
  if (appt.trainingSession) throw new ServiceError("התור כבר משויך למפגש אילוף", "CONFLICT");
  if (!isLinkableProgram(program) || program.status !== "ACTIVE") {
    throw new ServiceError("אפשר לשייך רק לתוכנית אילוף פרטנית פעילה", "VALIDATION");
  }
  if (program.customerId !== appt.customerId) throw new ServiceError("התוכנית שייכת ללקוח אחר", "VALIDATION");
  if (appt.petId && appt.petId !== program.dogId) throw new ServiceError("התוכנית שייכת לכלב אחר", "VALIDATION");

  const { sessionDate, durationMinutes } = appointmentToSessionTimes(
    appt.date, appt.startTime, appt.endTime, await businessTz(db, businessId)
  );

  // A meeting already scheduled at that exact time (e.g. booked before this feature) is the same meeting.
  const sameSlot = program.sessions.find(
    (s) => s.status === "SCHEDULED" && !s.appointmentId && s.sessionDate.getTime() === sessionDate.getTime()
  );
  if (sameSlot) {
    const r = await db.trainingProgramSession.updateMany({
      where: { id: sameSlot.id, appointmentId: null },
      data: { appointmentId: appt.id, durationMinutes },
    });
    if (r.count === 1) return { sessionId: sameSlot.id, sessionNumber: sameSlot.sessionNumber ?? nextSessionNumber(program.sessions) };
  }

  if (program.totalSessions != null && liveCount(program.sessions) >= program.totalSessions) {
    throw new ServiceError("כל המפגשים בחבילה כבר נקבעו", "VALIDATION");
  }
  const num = nextSessionNumber(program.sessions);
  const session = await db.trainingProgramSession.create({
    data: {
      trainingProgramId: program.id,
      sessionNumber: num,
      sessionDate,
      durationMinutes,
      status: appt.status === "completed" ? "COMPLETED" : "SCHEDULED",
      appointmentId: appt.id,
    },
    select: { id: true },
  });
  if (!appt.petId) {
    await db.appointment.update({ where: { id: appt.id }, data: { petId: program.dogId } });
  }
  return { sessionId: session.id, sessionNumber: num };
}

/**
 * Keep the linked meeting in step after an appointment change (called by updateAppointment):
 * completed → meeting COMPLETED; canceled → a still-SCHEDULED meeting is removed (its
 * number is free again); back to scheduled → an empty COMPLETED meeting reverts;
 * date / time change → meeting time follows.
 */
export async function syncSessionFromAppointment(
  businessId: string,
  db: DbClient,
  appt: { id: string; status: string; date: Date; startTime: string; endTime: string },
  changed: { status?: boolean; time?: boolean }
): Promise<void> {
  const session = await db.trainingProgramSession.findFirst({
    where: { appointmentId: appt.id, program: { businessId } },
  });
  if (!session) return;

  if (changed.status && appt.status === "canceled") {
    if (session.status === "SCHEDULED" && !hasPlanningContent(session)) {
      await db.trainingProgramSession.delete({ where: { id: session.id } });
    } else {
      // Keep what the trainer wrote; a not-yet-held meeting becomes CANCELED (frees its number).
      await db.trainingProgramSession.update({
        where: { id: session.id },
        data: { appointmentId: null, ...(session.status === "SCHEDULED" ? { status: "CANCELED" } : {}) },
      });
    }
    return;
  }

  const data: Record<string, unknown> = {};
  if (changed.status && appt.status === "completed" && session.status === "SCHEDULED") data.status = "COMPLETED";
  if (
    changed.status && LIVE_APPT_STATUSES.includes(appt.status) && session.status === "COMPLETED" &&
    !session.summary && !session.rating
  ) {
    data.status = "SCHEDULED";
  }
  if (changed.time) {
    const t = appointmentToSessionTimes(appt.date, appt.startTime, appt.endTime, await businessTz(db, businessId));
    data.sessionDate = t.sessionDate;
    data.durationMinutes = t.durationMinutes;
  }
  if (Object.keys(data).length > 0) {
    await db.trainingProgramSession.update({ where: { id: session.id }, data });
  }
}

/** Before an appointment row is deleted: a still-SCHEDULED linked meeting goes with it. */
export async function releaseSessionOfDeletedAppointment(
  businessId: string,
  db: DbClient,
  appointmentId: string
): Promise<void> {
  if (!appointmentId || !businessId) return; // an undefined filter would widen the delete
  const session = await db.trainingProgramSession.findFirst({ where: { appointmentId, program: { businessId } } });
  if (!session || session.status !== "SCHEDULED") return; // FK SetNull unlinks the rest
  if (hasPlanningContent(session)) {
    await db.trainingProgramSession.update({ where: { id: session.id }, data: { status: "CANCELED", appointmentId: null } });
  } else {
    await db.trainingProgramSession.delete({ where: { id: session.id } });
  }
}

/** After a meeting's time changed in the training screen: move its appointment. Returns the appointment id. */
export async function moveAppointmentOfSession(
  businessId: string,
  db: DbClient,
  session: { appointmentId: string | null; sessionDate: Date; durationMinutes: number }
): Promise<string | null> {
  if (!session.appointmentId) return null;
  const t = sessionToAppointmentTimes(session.sessionDate, session.durationMinutes, await businessTz(db, businessId));
  const r = await db.appointment.updateMany({
    where: { id: session.appointmentId, businessId, status: { in: LIVE_APPT_STATUSES } },
    data: { date: t.date, startTime: t.startTime, endTime: t.endTime },
  });
  return r.count ? session.appointmentId : null;
}

/** Meeting logged as done in the training screen → its appointment is completed too. Returns the id when changed. */
export async function completeAppointmentOfSession(
  businessId: string,
  db: DbClient,
  appointmentId: string | null
): Promise<string | null> {
  if (!appointmentId) return null;
  const r = await db.appointment.updateMany({
    where: { id: appointmentId, businessId, status: { in: LIVE_APPT_STATUSES } },
    data: { status: "completed" },
  });
  return r.count ? appointmentId : null;
}

/** Meeting deleted in the training screen → its (still scheduled) appointment is canceled. Returns the id when changed. */
export async function cancelAppointmentOfSession(
  businessId: string,
  db: DbClient,
  appointmentId: string | null
): Promise<string | null> {
  if (!appointmentId) return null;
  const r = await db.appointment.updateMany({
    where: { id: appointmentId, businessId, status: { in: LIVE_APPT_STATUSES } },
    data: { status: "canceled", cancellationNote: "המפגש נמחק מתוכנית האילוף" },
  });
  return r.count ? appointmentId : null;
}

/**
 * Program deleted / converted to a group: its meetings' still-live appointments are
 * canceled (otherwise they keep sending customer reminders). Returns the canceled ids —
 * the caller runs afterLinkedAppointmentCanceled for each.
 */
export async function cancelAppointmentsOfProgram(
  businessId: string,
  db: DbClient,
  programId: string
): Promise<string[]> {
  if (!programId || !businessId) return [];
  const linked = await db.trainingProgramSession.findMany({
    where: { trainingProgramId: programId, program: { businessId }, appointmentId: { not: null }, status: "SCHEDULED" },
    select: { appointmentId: true },
  });
  const out: string[] = [];
  for (const s of linked) {
    const id = await db.appointment.updateMany({
      where: { id: s.appointmentId as string, businessId, status: { in: LIVE_APPT_STATUSES } },
      data: { status: "canceled", cancellationNote: "תוכנית האילוף נמחקה" },
    });
    if (id.count) out.push(s.appointmentId as string);
  }
  return out;
}
