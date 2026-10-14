/**
 * Lead meetings — meetings booked with a LEAD before it is a customer.
 *
 * - create / move: lead stays a lead; the meeting blocks online-booking slots
 *   (src/lib/slots.ts) and gets a WhatsApp reminder (scheduleLeadMeetingReminder).
 * - outcome "completed": the lead is converted to a customer (convertLeadToCustomer)
 *   and a COMPLETED Appointment is written so the visit is in the customer's history.
 * - outcome "no_show": the lead stays a lead and gets a follow-up date.
 * - cancel: meeting canceled, reminder canceled.
 *
 * Every query is scoped by businessId (rule #10). No interactive $transaction (rule #17).
 */
import type { PrismaClient } from "@prisma/client";
import { ServiceError } from "@/services/types";
import { clearLeadFollowUps } from "@/services/clients";
import { cancelLeadFollowup, cancelLeadMeetingReminder, scheduleLeadMeetingReminder } from "@/lib/reminder-service";
import {
  LEAD_MEETING_APPOINTMENT_TAG,
  canTransition,
  validateMeetingSlot,
  type LeadMeetingOutcome,
} from "@/lib/lead-meetings";

export type DbClient = PrismaClient;

export const LEAD_MEETING_SELECT = {
  id: true,
  leadId: true,
  date: true,
  startTime: true,
  endTime: true,
  serviceId: true,
  location: true,
  notes: true,
  status: true,
  outcomeAt: true,
  appointmentId: true,
  createdAt: true,
  service: { select: { id: true, name: true } },
} as const;

export interface LeadMeetingInput {
  date: string;        // YYYY-MM-DD (Israel calendar day)
  startTime: string;   // HH:mm Israel local
  endTime: string;     // HH:mm Israel local
  serviceId?: string | null;
  location?: string | null;
  notes?: string | null;
}

function cleanText(v: string | null | undefined, max: number): string | null {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  if (!t) return null;
  if (t.length > max) throw new ServiceError(`הטקסט ארוך מדי (מקסימום ${max} תווים)`, "VALIDATION");
  return t;
}

async function loadLead(businessId: string, db: DbClient, leadId: string) {
  const lead = await db.lead.findFirst({
    where: { id: leadId, businessId },
    select: { id: true, name: true, phone: true, email: true, notes: true, source: true, customerId: true, wonAt: true, lostAt: true },
  });
  if (!lead) throw new ServiceError("ליד לא נמצא", "NOT_FOUND");
  return lead;
}

async function assertService(businessId: string, db: DbClient, serviceId: string | null | undefined) {
  if (!serviceId) return null;
  const svc = await db.service.findFirst({ where: { id: serviceId, businessId }, select: { id: true } });
  if (!svc) throw new ServiceError("שירות לא נמצא", "NOT_FOUND");
  return svc.id;
}

/** Re-schedule the reminder from the current DB row (cancel first; no-op when not applicable). */
async function refreshReminder(db: DbClient, businessId: string, meetingId: string) {
  await cancelLeadMeetingReminder(meetingId);
  const m = await db.leadMeeting.findFirst({
    where: { id: meetingId, businessId, status: "scheduled" },
    select: {
      id: true, businessId: true, date: true, startTime: true, location: true,
      service: { select: { name: true } },
      lead: { select: { name: true, phone: true, customerId: true } },
    },
  });
  if (!m) return;
  await scheduleLeadMeetingReminder(m).catch((err) =>
    console.error("scheduleLeadMeetingReminder failed (non-critical):", err)
  );
}

export async function listLeadMeetings(businessId: string, db: DbClient, leadId: string) {
  await loadLead(businessId, db, leadId);
  return db.leadMeeting.findMany({
    where: { businessId, leadId },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
    take: 50,
    select: LEAD_MEETING_SELECT,
  });
}

/** Scheduled meetings in a date range (calendar overlay). */
export async function listLeadMeetingsInRange(businessId: string, db: DbClient, fromYmd: string, toYmd: string) {
  return db.leadMeeting.findMany({
    where: {
      businessId,
      status: "scheduled",
      date: { gte: new Date(`${fromYmd}T00:00:00Z`), lte: new Date(`${toYmd}T23:59:59Z`) },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 500,
    select: {
      ...LEAD_MEETING_SELECT,
      lead: { select: { id: true, name: true, phone: true } },
    },
  });
}

export async function createLeadMeeting(
  businessId: string,
  db: DbClient,
  leadId: string,
  input: LeadMeetingInput,
  userId: string | null,
) {
  const lead = await loadLead(businessId, db, leadId);
  if (lead.customerId) {
    throw new ServiceError("הליד כבר לקוח — קבע/י תור רגיל ביומן", "CONFLICT");
  }
  const err = validateMeetingSlot(input);
  if (err) throw new ServiceError(err, "VALIDATION");
  const serviceId = await assertService(businessId, db, input.serviceId);

  const meeting = await db.leadMeeting.create({
    data: {
      businessId,
      leadId,
      date: new Date(`${input.date}T00:00:00Z`),
      startTime: input.startTime,
      endTime: input.endTime,
      serviceId,
      location: cleanText(input.location, 200),
      notes: cleanText(input.notes, 2000),
      createdByUserId: userId,
    },
    select: LEAD_MEETING_SELECT,
  });
  await refreshReminder(db, businessId, meeting.id);
  return meeting;
}

/** Move / edit a scheduled meeting ("נדחתה" = new date). The reminder follows. */
export async function updateLeadMeeting(
  businessId: string,
  db: DbClient,
  leadId: string,
  meetingId: string,
  input: Partial<LeadMeetingInput>,
) {
  const current = await db.leadMeeting.findFirst({
    where: { id: meetingId, businessId, leadId },
    select: { status: true, date: true, startTime: true, endTime: true },
  });
  if (!current) throw new ServiceError("הפגישה לא נמצאה", "NOT_FOUND");
  if (current.status !== "scheduled") throw new ServiceError("אפשר לשנות רק פגישה שעוד לא נסגרה", "CONFLICT");

  const next = {
    date: input.date ?? current.date.toISOString().slice(0, 10),
    startTime: input.startTime ?? current.startTime,
    endTime: input.endTime ?? current.endTime,
  };
  const err = validateMeetingSlot(next);
  if (err) throw new ServiceError(err, "VALIDATION");

  const data: Record<string, unknown> = {
    date: new Date(`${next.date}T00:00:00Z`),
    startTime: next.startTime,
    endTime: next.endTime,
  };
  if (input.serviceId !== undefined) data.serviceId = await assertService(businessId, db, input.serviceId);
  if (input.location !== undefined) data.location = cleanText(input.location, 200);
  if (input.notes !== undefined) data.notes = cleanText(input.notes, 2000);

  const res = await db.leadMeeting.updateMany({ where: { id: meetingId, businessId, status: "scheduled" }, data });
  if (res.count === 0) throw new ServiceError("הפגישה כבר נסגרה", "CONFLICT");
  await refreshReminder(db, businessId, meetingId);
  return db.leadMeeting.findFirstOrThrow({ where: { id: meetingId, businessId }, select: LEAD_MEETING_SELECT });
}

export async function cancelLeadMeeting(businessId: string, db: DbClient, leadId: string, meetingId: string) {
  const res = await db.leadMeeting.updateMany({
    where: { id: meetingId, businessId, leadId, status: "scheduled" },
    data: { status: "canceled", outcomeAt: new Date() },
  });
  if (res.count === 0) throw new ServiceError("הפגישה לא נמצאה או כבר נסגרה", "NOT_FOUND");
  await cancelLeadMeetingReminder(meetingId);
  return { ok: true };
}

/**
 * Convert a lead to a customer — the single implementation behind
 * POST /api/leads/[id]/convert and the "התקיימה" outcome of a lead meeting.
 * Reuses an already-linked customer; marks the lead won; cancels follow-ups.
 */
export async function convertLeadToCustomer(businessId: string, db: DbClient, leadId: string, userId: string) {
  const lead = await db.lead.findFirst({ where: { id: leadId, businessId } });
  if (!lead) throw new ServiceError("ליד לא נמצא", "NOT_FOUND");

  if (lead.wonAt && lead.customerId) {
    const customer = await db.customer.findFirst({ where: { id: lead.customerId, businessId } });
    if (customer) return { customer, lead, alreadyConverted: true as const };
  }

  let wonStage = await db.leadStage.findFirst({ where: { businessId, isWon: true } });
  if (!wonStage) {
    const maxOrder = await db.leadStage.count({ where: { businessId } });
    wonStage = await db.leadStage.create({
      data: { businessId, name: "נסגר בהצלחה", color: "#10b981", sortOrder: maxOrder + 1, isWon: true, isLost: false },
    });
  }

  let customer = lead.customerId
    ? await db.customer.findFirst({ where: { id: lead.customerId, businessId } })
    : null;
  if (!customer) {
    customer = await db.customer.create({
      data: {
        name: lead.name,
        phone: lead.phone ?? "",
        email: lead.email ?? null,
        notes: lead.notes ?? null,
        source: lead.source ?? "lead",
        tags: "[]",
        businessId,
      },
    });
    await db.timelineEvent.create({
      data: { type: "customer_created", description: `לקוח נוצר מליד: ${customer.name}`, customerId: customer.id, businessId },
    });
  }

  const updatedLead = await db.lead.update({
    where: { id: leadId },
    data: { stage: wonStage.id, wonAt: new Date(), wonByUserId: userId, lostByUserId: null, customerId: customer.id },
  });

  await cancelLeadFollowup(leadId).catch((err) => console.error("cancelLeadFollowup (convert) failed (non-critical):", err));
  await clearLeadFollowUps(businessId, db, leadId).catch((err) =>
    console.error("clearLeadFollowUps (convert) failed (non-critical):", err)
  );

  return { customer, lead: updatedLead, alreadyConverted: false as const };
}

/**
 * Record what happened at the meeting.
 * - completed → lead becomes a customer + a COMPLETED appointment (history/revenue).
 * - no_show  → lead stays a lead; follow-up date set (default: tomorrow 10:00 Israel).
 */
export async function recordLeadMeetingOutcome(
  businessId: string,
  db: DbClient,
  leadId: string,
  meetingId: string,
  outcome: LeadMeetingOutcome,
  userId: string,
  opts: { followUpAt?: string | null } = {},
) {
  const meeting = await db.leadMeeting.findFirst({
    where: { id: meetingId, businessId, leadId },
    select: { id: true, status: true, date: true, startTime: true, endTime: true, serviceId: true, notes: true, location: true },
  });
  if (!meeting) throw new ServiceError("הפגישה לא נמצאה", "NOT_FOUND");
  if (!canTransition(meeting.status, outcome)) throw new ServiceError("הפגישה כבר נסגרה", "CONFLICT");

  // Claim the meeting first so a double click can't convert twice.
  const claimed = await db.leadMeeting.updateMany({
    where: { id: meetingId, businessId, status: "scheduled" },
    data: { status: outcome, outcomeAt: new Date() },
  });
  if (claimed.count === 0) throw new ServiceError("הפגישה כבר נסגרה", "CONFLICT");
  await cancelLeadMeetingReminder(meetingId);

  if (outcome === "no_show") {
    const followUp = opts.followUpAt ? new Date(opts.followUpAt) : defaultFollowUp();
    if (Number.isNaN(followUp.getTime())) throw new ServiceError("תאריך מעקב לא תקין", "VALIDATION");
    await db.lead.updateMany({
      where: { id: leadId, businessId },
      data: { nextFollowUpAt: followUp, followUpStatus: "pending" },
    });
    return { outcome, customer: null, appointmentId: null };
  }

  // completed
  try {
    const { customer } = await convertLeadToCustomer(businessId, db, leadId, userId);
    const noteParts = [LEAD_MEETING_APPOINTMENT_TAG, meeting.location, meeting.notes].filter(Boolean);
    const appt = await db.appointment.create({
      data: {
        businessId,
        customerId: customer.id,
        date: meeting.date,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        serviceId: meeting.serviceId,
        notes: noteParts.join(" · ").slice(0, 2000),
        status: "completed",
      },
      select: { id: true },
    });
    await db.leadMeeting.updateMany({ where: { id: meetingId, businessId }, data: { appointmentId: appt.id } });
    return { outcome, customer: { id: customer.id, name: customer.name }, appointmentId: appt.id };
  } catch (err) {
    // Release the claim so the owner can retry.
    await db.leadMeeting.updateMany({
      where: { id: meetingId, businessId, status: "completed", appointmentId: null },
      data: { status: "scheduled", outcomeAt: null },
    }).catch(() => {});
    throw err;
  }
}

/** Tomorrow 10:00 Israel time (07:00 UTC in winter / 07:00–08:00 drift is fine for a follow-up). */
function defaultFollowUp(now: Date = new Date()): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(now.getTime() + 24 * 3600 * 1000));
  return new Date(`${ymd}T07:00:00Z`);
}
