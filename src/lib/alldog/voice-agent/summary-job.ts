/**
 * AllDog voice agent — the end-of-call summary queue + the stale-call cleanup.
 * Started by the end-of-call webhook itself (20 s after the call) and, as the safety net, by
 * /api/cron/alldog-call-retry (every 5 minutes, Supabase pg_cron) — no new scheduler.
 *
 * processVoiceSummary — the VoiceAgentCall row is the lock (conditional updateMany, like
 * PaycallCallRetry): attempt 1 right after the call, then +3, +10, +30 min, +2 h (final).
 * The summary is ALWAYS written, whether save_details ran or not, by the SAME code as the WhatsApp
 * bot's summary (src/lib/alldog/summary-core.ts — same model, fields and journal lines). One attempt:
 *   1. Claude summarizes the transcript (skipped when the caller said nothing).
 *   2. A call that ended WITHOUT /book or /details gets its lead + "לחזור טלפונית" task
 *      (callbackDecision: not for a hidden number, not for a silent call under 10 s, not for a call
 *      that is not about the caller's dog) — also when step 1 failed, so it never waits for a retry.
 *   3. The lead's empty fields (name, city, dog) are filled from the summary.
 *   4. The summary found an urgent case nobody flagged → URGENT task + the urgent alerts.
 *   5. The call's ONE journal line on the lead (summaryCallLogId) — a line of its own, next to the
 *      WhatsApp summary line, never replacing it.
 *   6. The rep's alert (bell + WhatsApp) with the summary line, once per call.
 * Final failure → ElevenLabs' own summary is written instead + an alert to Or (voice_summary).
 *
 * cleanupStaleVoiceCalls — a call still "in_progress" 60 minutes after it started never got its
 * webhook: marked "failed", the caller (if the number is known and no lead/task yet) gets the
 * callback task, and Or gets an alert once a day.
 */
import prisma from "@/lib/prisma";
import { claimOnce } from "@/lib/rate-limit";
import { notifyOwnerAllDog } from "@/lib/notify-owner";
import { alertAllDogFailure } from "@/lib/alldog/failure-alerts";
import { voiceAgentSettings } from "@/lib/alldog/config";
import { addLeadCallLog, appUrl, isPlaceholderLeadName, updateLeadCallLog } from "@/lib/alldog/leads";
import { heDayLabel, israelParts } from "@/lib/alldog/time";
import { ensureCallbackTask, handleUrgent, saveVoiceLead } from "@/lib/alldog/voice-agent/booking";
import { callbackDueAt, callbackDueLabel, type VoiceDetails } from "@/lib/alldog/voice-agent/booking-rules";
import { alertSalesRep } from "@/lib/alldog/voice-agent/rep-alert";
import {
  STALE_CALL_MS,
  callbackDecision,
  hasUserWords,
  nextSummaryAttemptAt,
  transcriptText,
  type CallbackDecision,
  type StoredTranscript,
} from "@/lib/alldog/voice-agent/end-rules";
import { formatVoiceSummary, summarizeConversation, summaryOneLine, type VoiceSummary } from "@/lib/alldog/summary-core";

const LOCK_MS = 5 * 60 * 1000;
const DAY_SECONDS = 24 * 60 * 60;
/** The model reads the end of a long call (same idea as the WhatsApp summary's last 12,000 characters). */
const TRANSCRIPT_FOR_SUMMARY_CHARS = 30_000;
const NO_WORDS_NOTE = "המתקשר לא דיבר בשיחה.";

type CallRow = NonNullable<Awaited<ReturnType<typeof loadCall>>>;

function loadCall(id: string) {
  return prisma.voiceAgentCall.findUnique({
    where: { id },
    select: {
      id: true, businessId: true, providerConversationId: true, leadId: true, callerPhoneNorm: true, outcome: true,
      startedAt: true, createdAt: true, durationSeconds: true, transcript: true, salesBrief: true, leadMeetingId: true,
      summaryAttempts: true, summaryCallLogId: true,
    },
  });
}

function storedTranscript(row: { transcript: unknown }): StoredTranscript {
  const t = (row.transcript ?? {}) as Partial<StoredTranscript>;
  return { turns: Array.isArray(t.turns) ? t.turns : [], omittedTurns: t.omittedTurns ?? 0, providerSummary: t.providerSummary ?? null, terminationReason: t.terminationReason ?? null };
}

function dateLabel(d: Date | null): string | null {
  if (!d) return null;
  const p = israelParts(d);
  return `${p.ymd.slice(8, 10)}/${p.ymd.slice(5, 7)} ${p.hhmm}`;
}

/** What the summary heard → the same details shape save_details sends (fill-empty on the lead). */
export function detailsFromSummary(s: VoiceSummary | null): VoiceDetails {
  if (!s) return {};
  const urgent = s.urgency_level === "high";
  return {
    fullName: s.caller_name, dogName: s.dog_name, breed: s.dog_breed, age: s.dog_age, city: s.city, problem: s.problem,
    urgent, urgentReason: urgent ? s.urgency ?? s.problem : null, eventWhen: s.event_when,
  };
}

/**
 * Lead + "לחזור טלפונית" for a call that ended without /book or /details, with whatever the
 * summary heard. Idempotent: once an outcome is set it is a no-op.
 */
export async function ensureFollowupForCall(row: CallRow, now: Date, s: VoiceSummary | null = null): Promise<CallbackDecision> {
  const t = storedTranscript(row);
  const decision = callbackDecision({
    outcome: row.outcome, phoneNorm: row.callerPhoneNorm, durationSeconds: row.durationSeconds,
    userWords: hasUserWords(t.turns), relevant: s ? s.relevant : true,
  });
  const callAt = row.startedAt ?? row.createdAt;
  if (decision.open && row.callerPhoneNorm) {
    const details = detailsFromSummary(s);
    const { lead, displayName } = await saveVoiceLead(row.businessId, { conversationId: row.providerConversationId, ...details }, row.callerPhoneNorm, now);
    await ensureCallbackTask(row.businessId, lead.id, displayName, row.callerPhoneNorm, details, callAt);
    await prisma.voiceAgentCall.update({ where: { id: row.id }, data: { outcome: details.urgent ? "urgent" : "hung_up_early", leadId: lead.id } });
    await handleUrgent(row.businessId, row.providerConversationId, lead.id, displayName, row.callerPhoneNorm, details, callAt);
  } else if (!row.outcome) {
    // Hidden number / silent short call / not about a dog: no task, but the outcome is recorded.
    await prisma.voiceAgentCall.update({ where: { id: row.id }, data: { outcome: !decision.open && decision.reason === "not_relevant" ? "not_relevant" : "hung_up_early" } });
  }
  return decision;
}

/**
 * save_details / book ran (the lead exists): fill what is still empty from the summary, and raise
 * the urgent task + alerts when the summary found an urgent case the tool call did not flag.
 */
async function applySummaryToLead(row: CallRow, s: VoiceSummary, now: Date): Promise<void> {
  if (!row.leadId || !row.callerPhoneNorm) return;
  const details = detailsFromSummary(s);
  const callAt = row.startedAt ?? row.createdAt;
  const { lead, displayName } = await saveVoiceLead(row.businessId, { conversationId: row.providerConversationId, ...details }, row.callerPhoneNorm, now, { keepBrief: true });
  if (details.urgent && row.outcome !== "urgent") {
    await ensureCallbackTask(row.businessId, lead.id, displayName, row.callerPhoneNorm, details, callAt);
    await prisma.voiceAgentCall.update({ where: { id: row.id }, data: { outcome: "urgent" } });
    await handleUrgent(row.businessId, row.providerConversationId, lead.id, displayName, row.callerPhoneNorm, details, callAt);
  }
}

async function outcomeLine(row: CallRow, decision: CallbackDecision | null): Promise<string> {
  const rep = voiceAgentSettings().salesRepName;
  const callAt = row.startedAt ?? row.createdAt;
  const due = `לחזור טלפונית: ${callbackDueLabel(callbackDueAt(callAt), callAt)}`;
  let booked: string | null = null;
  if (row.leadMeetingId) {
    const m = await prisma.leadMeeting.findFirst({ where: { id: row.leadMeetingId }, select: { date: true, startTime: true, status: true } });
    if (m) booked = `נקבעה שיחה טלפונית עם ${rep} ל${heDayLabel(m.date.toISOString().slice(0, 10))} בשעה ${m.startTime}${m.status === "canceled" ? " (בוטלה מאז)" : ""}`;
  }
  switch (row.outcome) {
    case "meeting_booked": return booked ?? "נקבעה שיחת מכירה";
    case "details_only": return `נאספו פרטים · ${due}`;
    case "urgent": return `דחוף · ${booked ?? due}`;
    case "not_relevant": return "לא רלוונטי (לפי הסיכום)";
    case "hung_up_early":
      if (decision && !decision.open && decision.reason === "hidden_number") return "מספר חסוי · אין למי לחזור";
      if (decision && !decision.open && decision.reason === "silent_short_call") return "שיחה קצרה, המתקשר לא דיבר";
      return `השיחה הסתיימה בלי שנאספו פרטים · ${due}`;
    default: return "לא ידוע";
  }
}

/** Create or update the call's one journal line on the lead (none without a lead, e.g. a hidden number). */
async function writeJournal(row: CallRow, text: string): Promise<string | null> {
  if (!row.leadId) return null;
  if (row.summaryCallLogId) {
    await updateLeadCallLog(row.summaryCallLogId, row.leadId, text);
    return row.summaryCallLogId;
  }
  return (await addLeadCallLog(row.leadId, text)).id;
}

/** What /book or /details collected wins; the summary fills what they did not ask. */
function mergedBrief(existing: unknown, s: VoiceSummary): Record<string, string | null> {
  const e = (existing && typeof existing === "object" ? existing : {}) as Record<string, string | null>;
  const pick = (k: string, v: string | null) => (typeof e[k] === "string" && e[k] ? e[k] : v);
  return {
    name: pick("name", s.caller_name), dog: pick("dog", s.dog_name), breed: pick("breed", s.dog_breed), age: pick("age", s.dog_age),
    city: pick("city", s.city), problem: pick("problem", s.problem), urgency: pick("urgency", s.urgency_level),
    notes: pick("notes", s.urgency), eventWhen: pick("eventWhen", s.event_when),
  };
}

/**
 * The rep's alert with the summary line — once per call. Not for a call that is not about a dog,
 * nor for a silent call nobody can return. A hidden number that left none still alerts (and Or too),
 * so the call does not disappear.
 */
async function alertRep(row: CallRow, decision: CallbackDecision | null, line: string | null): Promise<void> {
  if (row.outcome === "not_relevant") return;
  const noLead = !row.leadId;
  if (noLead && decision && !decision.open && decision.reason === "silent_short_call") return;
  if (noLead && !hasUserWords(storedTranscript(row).turns)) return;
  const callAt = row.startedAt ?? row.createdAt;
  let displayName = row.callerPhoneNorm ?? "מתקשר לא מזוהה";
  if (row.leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: row.leadId, businessId: row.businessId }, select: { name: true } });
    if (lead && !isPlaceholderLeadName(lead.name)) displayName = lead.name;
  }
  const sent = await alertSalesRep({
    businessId: row.businessId, conversationId: row.providerConversationId, kind: "summary", leadId: row.leadId,
    displayName, phone: row.callerPhoneNorm, urgent: row.outcome === "urgent", line,
    dueLabel: row.callerPhoneNorm ? callbackDueLabel(callbackDueAt(callAt), callAt) : null,
  });
  if (sent && noLead) {
    // No number to call back → no lead and no task: Or hears about it too.
    await notifyOwnerAllDog({
      title: "שיחה עם אלירן ממספר חסוי, בלי מספר לחזרה",
      lines: [displayName, line ?? "אין סיכום", "לא נוצר ליד. התמליל שמור ברשומת השיחה."],
      url: `${appUrl()}/leads`,
    }).catch((err) => console.error("[alldog-voice summary] hidden-number alert failed", err));
  }
}

/** One attempt on one call. `force` skips the due-time check (the webhook's own trigger). */
export async function processVoiceSummary(id: string, now: Date = new Date(), opts: { force?: boolean } = {}): Promise<"done" | "retry" | "final" | "skipped"> {
  const claim = await prisma.voiceAgentCall.updateMany({
    where: {
      id, summary: null, summaryNextAt: opts.force ? { not: null } : { lte: now },
      OR: [{ summaryLockedUntil: null }, { summaryLockedUntil: { lt: now } }],
    },
    data: { summaryLockedUntil: new Date(now.getTime() + LOCK_MS), summaryAttempts: { increment: 1 } },
  });
  if (claim.count === 0) return "skipped";
  let row = await loadCall(id);
  if (!row) return "skipped";
  let decision: CallbackDecision | null = null;
  try {
    const t = storedTranscript(row);
    const spoke = hasUserWords(t.turns);
    let s: VoiceSummary | null = null;
    let summaryError: unknown = null;
    if (spoke) {
      try {
        s = await summarizeConversation("voice", transcriptText(t.turns).slice(-TRANSCRIPT_FOR_SUMMARY_CHARS));
        if (!s) summaryError = new Error("no usable summary (refusal / cut off / unparseable)");
      } catch (err) {
        summaryError = err;
      }
    }
    // The lead + task never wait for a summary retry.
    decision = await ensureFollowupForCall(row, now, s);
    row = (await loadCall(id))!;
    if (summaryError) {
      // The rep still hears about the call now (ElevenLabs' own summary, if any); the journal waits for the retry.
      await alertRep(row, decision, t.providerSummary);
      throw summaryError;
    }
    if (s) {
      await applySummaryToLead(row, s, now);
      row = (await loadCall(id))!;
    }
    const text = formatVoiceSummary({
      sum: s, dateLabel: dateLabel(row.startedAt ?? row.createdAt), durationSeconds: row.durationSeconds,
      outcomeLine: await outcomeLine(row, decision), note: s ? null : NO_WORDS_NOTE,
    });
    const logId = await writeJournal(row, text);
    await prisma.voiceAgentCall.update({
      where: { id },
      data: {
        summary: text, ...(s ? { salesBrief: mergedBrief(row.salesBrief, s) } : {}),
        summaryCallLogId: logId, summaryNextAt: null, summaryLockedUntil: null, summaryError: null,
      },
    });
    await alertRep(row, decision, s ? summaryOneLine(s) : NO_WORDS_NOTE);
    return "done";
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    const attempts = row.summaryAttempts;
    const next = nextSummaryAttemptAt(attempts, now);
    console.warn(`[alldog-voice summary] conv=${row.providerConversationId} attempt ${attempts} failed: ${message}${next ? "" : " (final)"}`);
    if (next) {
      await prisma.voiceAgentCall.update({ where: { id }, data: { summaryNextAt: next, summaryLockedUntil: null, summaryError: message } });
      return "retry";
    }
    // Final attempt: ElevenLabs' own summary (if any) so Racheli still has something, and an alert to Or.
    try {
      const fresh = (await loadCall(id))!;
      const t = storedTranscript(fresh);
      const fallback = t.providerSummary ?? "לא התקבל סיכום. התמליל המלא שמור ברשומת השיחה.";
      const text = formatVoiceSummary({
        sum: null, dateLabel: dateLabel(fresh.startedAt ?? fresh.createdAt), durationSeconds: fresh.durationSeconds,
        outcomeLine: await outcomeLine(fresh, decision),
        note: `${fallback}\n(סיכום אוטומטי של ElevenLabs — הסיכום הרגיל נכשל)`,
      });
      const logId = await writeJournal(fresh, text);
      await prisma.voiceAgentCall.update({ where: { id }, data: { summary: text, summaryCallLogId: logId, summaryNextAt: null, summaryLockedUntil: null, summaryError: message } });
      await alertAllDogFailure({ kind: "voice_summary", error: message, phone: fresh.callerPhoneNorm ?? undefined, leadId: fresh.leadId ?? undefined });
    } catch (fallbackErr) {
      console.error("[alldog-voice summary] final fallback failed", fallbackErr);
      await prisma.voiceAgentCall.update({ where: { id }, data: { summaryNextAt: null, summaryLockedUntil: null, summaryError: message } }).catch(() => undefined);
    }
    return "final";
  }
}

export async function processDueVoiceSummaries(
  opts: { budgetMs: number; limit: number },
  now: Date = new Date()
): Promise<{ processed: number; done: number; retry: number; final: number }> {
  const started = Date.now();
  const due = await prisma.voiceAgentCall.findMany({
    where: { summary: null, summaryNextAt: { lte: now }, OR: [{ summaryLockedUntil: null }, { summaryLockedUntil: { lt: now } }] },
    orderBy: { summaryNextAt: "asc" },
    take: opts.limit,
    select: { id: true },
  });
  const out = { processed: 0, done: 0, retry: 0, final: 0 };
  for (const { id } of due) {
    if (Date.now() - started > opts.budgetMs) break;
    const r = await processVoiceSummary(id, now);
    if (r === "skipped") continue;
    out.processed++;
    out[r]++;
  }
  return out;
}

export async function cleanupStaleVoiceCalls(opts: { limit: number }, now: Date = new Date()): Promise<{ failed: number }> {
  const stale = await prisma.voiceAgentCall.findMany({
    where: { status: "in_progress", createdAt: { lt: new Date(now.getTime() - STALE_CALL_MS) } },
    take: opts.limit,
    select: { id: true },
  });
  let failed = 0;
  for (const { id } of stale) {
    const claim = await prisma.voiceAgentCall.updateMany({ where: { id, status: "in_progress" }, data: { status: "failed" } });
    if (claim.count === 0) continue;
    failed++;
    const row = await loadCall(id);
    if (row && !row.outcome && row.callerPhoneNorm) {
      // No webhook → no duration / transcript: the caller may have talked, so the callback task is opened.
      try {
        const { lead, displayName } = await saveVoiceLead(row.businessId, { conversationId: row.providerConversationId }, row.callerPhoneNorm, now);
        await ensureCallbackTask(row.businessId, lead.id, displayName, row.callerPhoneNorm, {}, row.startedAt ?? row.createdAt);
        await prisma.voiceAgentCall.update({ where: { id }, data: { outcome: "hung_up_early", leadId: lead.id } });
      } catch (err) {
        console.error(`[alldog-voice cleanup] callback for ${id} failed`, err);
      }
    }
  }
  if (failed > 0 && (await claimOnce("alldog-voice-webhook-missing", DAY_SECONDS))) {
    await notifyOwnerAllDog({
      title: "webhook של סוף שיחה מ-ElevenLabs לא הגיע",
      lines: [
        `${failed} שיחות קוליות נשארו "בתהליך" יותר משעה וסומנו "נכשלה".`,
        "כנראה ה-webhook כבוי או מוגדר לא נכון ב-ElevenLabs (או שהניסיונות החוזרים כבויים). למי שהשאיר מספר נפתחה משימת לחזור טלפונית.",
      ],
      url: `${appUrl()}/leads`,
    }).catch((err) => console.error("[alldog-voice cleanup] alert failed", err));
  }
  return { failed };
}
