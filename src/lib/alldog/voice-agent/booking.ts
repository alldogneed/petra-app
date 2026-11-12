/**
 * AllDog voice agent — booking a sales call with Racheli (/book) and saving details only (/details).
 *
 * Lead: upsertLeadFromContact (the bot's function — returning contact / existing customer handled
 * there), fill EMPTY fields only (spoken names are unreliable; what Eliran heard stays in salesBrief).
 *
 * /book:
 *   1. the call already booked a meeting → that meeting (alreadyBooked)
 *   2. the lead already has a FUTURE scheduled LeadMeeting (any source) → that one (alreadyHasMeeting)
 *   3. the slot must be a sales slot ≥ 90 min ahead (BOOK_MIN_NOTICE_MS), else 3 alternatives
 *   4. ONE batch transaction (no interactive $transaction — PgBouncer, rule #17):
 *        pg_advisory_xact_lock(business) → INSERT LeadMeeting only if nothing overlaps (scheduled
 *        meeting / "חג" / "מכירות" block), the lead has no future meeting and the call has none →
 *        link VoiceAgentCall.leadMeetingId. Two bookings of the same slot cannot both pass.
 *      Nothing inserted → alreadyBooked / alreadyHasMeeting / slot_taken + 3 alternatives.
 *   5. stage → "תואמה שיחת מכירה" (by name), forward only, with a stage_change journal line;
 *      stage missing → booked anyway + warning (log + lead journal) + an alert to Or once a day.
 *
 * NOT done here (section 4): createLeadMeeting's side effect = the LeadMeeting WhatsApp reminder
 * (refreshReminder → scheduleLeadMeetingReminder). No confirmation message, no alert to Racheli yet.
 */
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { claimOnce } from "@/lib/rate-limit";
import { runAfterResponse } from "@/lib/wait-until";
import { notifyOwnerAllDog } from "@/lib/notify-owner";
import { alertNewLeadIfEnabled } from "@/lib/lead-alert";
import { updateLead } from "@/services/clients";
import { addLeadCallLog, appUrl, createLeadTask, isPlaceholderLeadName, upsertLeadFromContact } from "@/lib/alldog/leads";
import { israelInstant, israelParts, israelYmd } from "@/lib/alldog/time";
import { salesWorkdays, spokenSlotLabel, type SalesSlot } from "@/lib/alldog/voice-agent/slots";
import { loadSalesBusy } from "@/lib/alldog/voice-agent/busy";
import { callerPhoneNormOf, upsertCall } from "@/lib/alldog/voice-agent/start";
import {
  CALLBACK_TASK_PREFIX,
  SALES_CALL_LOCATION,
  SALES_CALL_NOTE,
  SALES_CALL_STAGE_NAME,
  URGENT_TITLE_PREFIX,
  VOICE_LEAD_SOURCE,
  VOICE_LOG_PREFIX,
  checkBookingSlot,
  cleanCity,
  cleanName,
  cleanReason,
  nearestAlternatives,
  petFromDetails,
  salesBriefFromDetails,
  shouldMoveToStage,
  type VoiceDetails,
} from "@/lib/alldog/voice-agent/booking-rules";

export interface VoiceLeadInput extends VoiceDetails {
  conversationId: string;
  callerPhone?: string | null;
  /** A number the caller said aloud — used only when the caller id is hidden. */
  callbackPhone?: string | null;
  externalCallId?: string | null;
}

export interface VoiceBookInput extends VoiceLeadInput {
  startsAt: string;
}

export interface MeetingRef { ymd: string; hhmm: string; startsAt: string; label: string }

export type VoiceBookResult =
  | { status: "booked"; meeting: MeetingRef; alreadyBooked?: true; stageChanged: boolean }
  | { status: "already_has_meeting"; alreadyHasMeeting: true; meeting: MeetingRef }
  | { status: "slot_taken" | "invalid_slot"; reason?: string; alternatives: SalesSlot[] }
  | { status: "existing_customer" }
  | { status: "phone_required" };

export type VoiceDetailsResult = { status: "saved" } | { status: "phone_required" };

const LOCK_PREFIX = "alldog-voice-sales:";
const STAGE_MISSING_ALERT_KEY = "alldog-voice-stage-missing";
const DAY_SECONDS = 24 * 60 * 60;

function meetingRef(ymd: string, hhmm: string, now: Date): MeetingRef {
  return { ymd, hhmm, startsAt: israelInstant(ymd, hhmm).toISOString(), label: spokenSlotLabel(ymd, hhmm, now) };
}

function leadLink(leadId: string): string {
  return `${appUrl()}/leads?lead=${leadId}`;
}

/** Create / update the lead (fill empty only), link it to the call, store what Eliran collected. */
async function saveVoiceLead(businessId: string, input: VoiceLeadInput, phone: string, now: Date) {
  const name = cleanName(input.fullName);
  const city = cleanCity(input.city);
  const { leadId, created } = await upsertLeadFromContact({
    businessId,
    phone,
    name,
    placeholderName: `שיחה קולית ${phone}`,
    refresh: false,
    source: VOICE_LEAD_SOURCE,
    city,
    pet: petFromDetails(input),
    creationNote: "נוצר אוטומטית משיחה עם אלירן (סוכן קולי).",
    attribution: {
      trafficSource: "phone",
      medium: null, campaign: null, landingPage: null, referrer: null, firstPage: null, gclid: null, pageType: null,
    },
    contactedAt: now,
  });
  if (created) {
    // Leads written through the service layer don't get POST /api/leads' "ליד חדש" alert — send it here (as the bot does).
    await runAfterResponse(
      alertNewLeadIfEnabled(businessId, { name: name || phone, phone, requestedService: null, city, source: VOICE_LEAD_SOURCE }),
    );
  }
  await prisma.voiceAgentCall.update({
    where: { providerConversationId: input.conversationId },
    data: { leadId, salesBrief: salesBriefFromDetails(input) },
  });
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, businessId },
    select: { id: true, name: true, stage: true, customerId: true },
  });
  if (!lead) throw new Error("voice lead vanished after upsert");
  return { lead, displayName: isPlaceholderLeadName(lead.name) ? phone : lead.name };
}

/**
 * The lead's open follow-up task, from any channel: "לחזור טלפונית…" or an urgent "דחוף: …" one.
 * Both the callback and the urgent path check this, so one call never leaves two tasks.
 */
function openFollowupTask(businessId: string, leadId: string) {
  return prisma.task.findFirst({
    where: {
      businessId, relatedEntityType: "LEAD", relatedEntityId: leadId, status: { in: ["OPEN", "IN_PROGRESS"] },
      OR: [{ title: { contains: CALLBACK_TASK_PREFIX } }, { title: { startsWith: URGENT_TITLE_PREFIX } }],
    },
    select: { id: true, title: true, priority: true },
  });
}

/** One "לחזור טלפונית" task per lead (an open one from the bot counts); urgent → "דחוף: " + URGENT. */
async function ensureCallbackTask(businessId: string, leadId: string, displayName: string, phone: string, input: VoiceDetails) {
  const urgent = !!input.urgent;
  const open = await openFollowupTask(businessId, leadId);
  if (open) {
    if (urgent && open.priority !== "URGENT") {
      await prisma.task.updateMany({
        where: { id: open.id, businessId },
        data: { priority: "URGENT", title: open.title.startsWith(URGENT_TITLE_PREFIX) ? open.title : `${URGENT_TITLE_PREFIX}${open.title}` },
      });
    }
    return;
  }
  await createLeadTask(businessId, leadId, {
    title: `${urgent ? URGENT_TITLE_PREFIX : ""}${CALLBACK_TASK_PREFIX} ל${displayName} (שיחה קולית)`,
    description: [
      urgent ? `דחוף: ${cleanReason(input.urgentReason) ?? "דיווח על נשיכה"}` : null,
      cleanReason(input.problem) ? `מה הלקוח מחפש: ${cleanReason(input.problem)}` : null,
      `טלפון: ${phone}`,
      "פרטים משיחה עם אלירן (סוכן קולי).",
    ].filter(Boolean).join("\n"),
    priority: urgent ? "URGENT" : "HIGH",
    dueDate: israelYmd(),
  });
}

/** Urgent (bite): the existing owner alert, once per call, + an URGENT task when there is none. */
async function handleUrgent(businessId: string, conversationId: string, leadId: string, displayName: string, phone: string, input: VoiceDetails) {
  if (!input.urgent) return;
  const reason = cleanReason(input.urgentReason) ?? "דיווח על נשיכה";
  if (await claimOnce(`alldog-voice-urgent:${conversationId}`, DAY_SECONDS)) {
    await runAfterResponse(
      notifyOwnerAllDog({
        title: "דחוף: דיווח על נשיכה בשיחה קולית (אלירן)",
        lines: [`${displayName} · טלפון: ${phone}`, reason],
        url: leadLink(leadId),
      }),
    );
  }
  const open = await openFollowupTask(businessId, leadId);
  if (open && open.priority !== "URGENT") {
    // An open (bot / earlier) callback task becomes the urgent one instead of a second task.
    await prisma.task.updateMany({
      where: { id: open.id, businessId },
      data: { priority: "URGENT", title: open.title.startsWith(URGENT_TITLE_PREFIX) ? open.title : `${URGENT_TITLE_PREFIX}${open.title}` },
    });
  }
  if (!open) {
    await createLeadTask(businessId, leadId, {
      title: `${URGENT_TITLE_PREFIX}להתקשר ל${displayName} (שיחה קולית)`,
      description: [reason, `טלפון: ${phone}`, "פרטים משיחה עם אלירן (סוכן קולי)."].join("\n"),
      priority: "URGENT",
      dueDate: israelYmd(),
    });
  }
}

/** The lead's next scheduled LeadMeeting that has not started yet, or null. */
async function futureMeetingOf(leadId: string, now: Date): Promise<MeetingRef | null> {
  const rows = await prisma.leadMeeting.findMany({
    where: { leadId, status: "scheduled", date: { gte: new Date(`${israelYmd(now)}T00:00:00Z`) } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: { date: true, startTime: true },
    take: 5,
  });
  const next = rows
    .map((m) => ({ ymd: m.date.toISOString().slice(0, 10), hhmm: m.startTime }))
    .find((m) => israelInstant(m.ymd, m.hhmm).getTime() > now.getTime());
  return next ? meetingRef(next.ymd, next.hhmm, now) : null;
}

async function alternativesFor(businessId: string, requested: Date | null, now: Date): Promise<SalesSlot[]> {
  return nearestAlternatives(requested, now, await loadSalesBusy(businessId, salesWorkdays(now)));
}

/** Forward-only move to "תואמה שיחת מכירה"; missing stage → warning + a daily alert. Returns whether it moved. */
async function moveToSalesCallStage(businessId: string, lead: { id: string; stage: string }): Promise<boolean> {
  const [target, current] = await Promise.all([
    prisma.leadStage.findFirst({ where: { businessId, name: SALES_CALL_STAGE_NAME, isWon: false, isLost: false }, select: { id: true, name: true, sortOrder: true } }),
    prisma.leadStage.findFirst({ where: { id: lead.stage, businessId }, select: { id: true, name: true, sortOrder: true, isWon: true, isLost: true } }),
  ]);
  if (!target) {
    console.warn(`[alldog-voice book] stage "${SALES_CALL_STAGE_NAME}" not found — meeting booked, stage unchanged (lead ${lead.id})`);
    await addLeadCallLog(lead.id, `${VOICE_LOG_PREFIX} ⚠ השלב "${SALES_CALL_STAGE_NAME}" לא נמצא — הפגישה נקבעה, השלב לא שונה`, "");
    if (await claimOnce(STAGE_MISSING_ALERT_KEY, DAY_SECONDS)) {
      await runAfterResponse(
        notifyOwnerAllDog({
          title: "אלירן קבע שיחת מכירה בלי לשנות שלב",
          lines: [
            `השלב "${SALES_CALL_STAGE_NAME}" לא נמצא בשלבי הלידים של AllDog.`,
            "הפגישה נקבעה כרגיל. צריך ליצור את השלב בהגדרות שלבי הלידים.",
          ],
          url: `${appUrl()}/leads`,
        }),
      );
    }
    return false;
  }
  if (current?.id === target.id || !shouldMoveToStage(current, target)) return false;
  await updateLead(businessId, prisma, lead.id, { stage: target.id });
  // updateLead writes no history line for a stage change (only the UI does) — same format as the UI.
  await prisma.callLog.create({
    data: { leadId: lead.id, type: "stage_change", summary: `הועבר מ"${current?.name ?? "לא ידוע"}" ל"${target.name}"`, treatment: "" },
  });
  return true;
}

export async function bookSalesCall(businessId: string, input: VoiceBookInput, now: Date = new Date()): Promise<VoiceBookResult> {
  const call = await upsertCall(businessId, input, callerPhoneNormOf(input.callerPhone), now);

  // 1. This call already booked a meeting (repeated request).
  if (call.leadMeetingId) {
    const m = await prisma.leadMeeting.findFirst({ where: { id: call.leadMeetingId, businessId, status: "scheduled" }, select: { date: true, startTime: true } });
    if (m) return { status: "booked", alreadyBooked: true, stageChanged: false, meeting: meetingRef(m.date.toISOString().slice(0, 10), m.startTime, now) };
  }

  const phone = callerPhoneNormOf(input.callerPhone) ?? callerPhoneNormOf(input.callbackPhone);
  if (!phone) return { status: "phone_required" };

  const { lead, displayName } = await saveVoiceLead(businessId, input, phone, now);
  await handleUrgent(businessId, input.conversationId, lead.id, displayName, phone, input);

  // A lead already converted to a customer cannot get a LeadMeeting (same rule as createLeadMeeting).
  if (lead.customerId) {
    await ensureCallbackTask(businessId, lead.id, displayName, phone, input);
    await prisma.voiceAgentCall.update({ where: { id: call.id }, data: { outcome: input.urgent ? "urgent" : "details_only" } });
    return { status: "existing_customer" };
  }

  // 2. The lead already has a future sales call / meeting (from any channel).
  const existing = await futureMeetingOf(lead.id, now);
  if (existing) return { status: "already_has_meeting", alreadyHasMeeting: true, meeting: existing };

  // 3. The requested slot.
  const slot = checkBookingSlot(input.startsAt, now);
  if (!slot.ok) {
    const requested = new Date(input.startsAt);
    return { status: "invalid_slot", reason: slot.reason, alternatives: await alternativesFor(businessId, isNaN(requested.getTime()) ? null : requested, now) };
  }

  // 4. Insert under a per-business advisory lock, only if nothing overlaps.
  const meetingId = randomUUID();
  const today = israelYmd(now);
  const nowHhmm = israelParts(now).hhmm;
  const day = `${slot.ymd} 00:00:00`;
  const startUtc = slot.start.toISOString().replace("Z", "");
  const endUtc = slot.end.toISOString().replace("Z", "");
  const [, inserted] = await prisma.$transaction([
    prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LOCK_PREFIX + businessId}))`,
    prisma.$executeRaw`
      INSERT INTO "LeadMeeting" ("id", "businessId", "leadId", "date", "startTime", "endTime", "location", "notes", "status", "createdAt", "updatedAt")
      SELECT ${meetingId}, ${businessId}, ${lead.id}, ${day}::timestamp, ${slot.hhmm}, ${slot.endHhmm}, ${SALES_CALL_LOCATION}, ${SALES_CALL_NOTE}, 'scheduled', NOW(), NOW()
      WHERE NOT EXISTS (
          SELECT 1 FROM "LeadMeeting" m
          WHERE m."businessId" = ${businessId} AND m."status" = 'scheduled' AND m."date" = ${day}::timestamp
            AND m."startTime" < ${slot.endHhmm} AND ${slot.hhmm} < m."endTime")
        AND NOT EXISTS (
          SELECT 1 FROM "AvailabilityBlock" b
          WHERE b."businessId" = ${businessId} AND b."startAt" < ${endUtc}::timestamp AND b."endAt" > ${startUtc}::timestamp
            AND (b."reason" LIKE ${"%חג%"} OR b."reason" LIKE ${"%מכירות%"}))
        AND NOT EXISTS (
          SELECT 1 FROM "LeadMeeting" f
          WHERE f."leadId" = ${lead.id} AND f."status" = 'scheduled'
            AND (f."date" > ${`${today} 00:00:00`}::timestamp OR (f."date" = ${`${today} 00:00:00`}::timestamp AND f."startTime" > ${nowHhmm})))
        AND NOT EXISTS (
          SELECT 1 FROM "VoiceAgentCall" v
          WHERE v."providerConversationId" = ${input.conversationId} AND v."leadMeetingId" IS NOT NULL)`,
    prisma.$executeRaw`
      UPDATE "VoiceAgentCall" SET "leadMeetingId" = ${meetingId}, "updatedAt" = NOW()
      WHERE "providerConversationId" = ${input.conversationId} AND "leadMeetingId" IS NULL
        AND EXISTS (SELECT 1 FROM "LeadMeeting" WHERE "id" = ${meetingId})`,
  ]);

  if (inserted !== 1) {
    const again = await prisma.voiceAgentCall.findUnique({ where: { id: call.id }, select: { leadMeetingId: true } });
    if (again?.leadMeetingId) {
      const m = await prisma.leadMeeting.findFirst({ where: { id: again.leadMeetingId, businessId }, select: { date: true, startTime: true } });
      if (m) return { status: "booked", alreadyBooked: true, stageChanged: false, meeting: meetingRef(m.date.toISOString().slice(0, 10), m.startTime, now) };
    }
    const theirs = await futureMeetingOf(lead.id, now);
    if (theirs) return { status: "already_has_meeting", alreadyHasMeeting: true, meeting: theirs };
    return { status: "slot_taken", alternatives: await alternativesFor(businessId, slot.start, now) };
  }

  // 5. Stage + journal + outcome.
  const stageChanged = await moveToSalesCallStage(businessId, lead);
  const meeting = meetingRef(slot.ymd, slot.hhmm, now);
  await addLeadCallLog(lead.id, `${VOICE_LOG_PREFIX} נקבעה שיחת מכירה טלפונית עם רחלי ל${meeting.label}`, "");
  await prisma.voiceAgentCall.update({ where: { id: call.id }, data: { outcome: input.urgent ? "urgent" : "meeting_booked" } });
  return { status: "booked", meeting, stageChanged };
}

export async function saveVoiceDetails(businessId: string, input: VoiceLeadInput, now: Date = new Date()): Promise<VoiceDetailsResult> {
  const call = await upsertCall(businessId, input, callerPhoneNormOf(input.callerPhone), now);
  const phone = callerPhoneNormOf(input.callerPhone) ?? callerPhoneNormOf(input.callbackPhone);
  if (!phone) return { status: "phone_required" };

  const { lead, displayName } = await saveVoiceLead(businessId, input, phone, now);
  await handleUrgent(businessId, input.conversationId, lead.id, displayName, phone, input);
  await ensureCallbackTask(businessId, lead.id, displayName, phone, input);
  await addLeadCallLog(lead.id, `${VOICE_LOG_PREFIX} נאספו פרטים, בלי קביעת שיחה · לחזור טלפונית`, "");
  // A call that already booked keeps "meeting_booked"; urgent always wins.
  const keepBooked = !!call.leadMeetingId && !input.urgent;
  if (!keepBooked) {
    await prisma.voiceAgentCall.update({ where: { id: call.id }, data: { outcome: input.urgent ? "urgent" : "details_only" } });
  }
  return { status: "saved" };
}
