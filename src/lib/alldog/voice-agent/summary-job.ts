/**
 * AllDog voice agent — the end-of-call summary queue + the stale-call cleanup.
 * Run by /api/cron/alldog-call-retry (every 5 minutes, Supabase pg_cron) — no new scheduler.
 *
 * processDueVoiceSummaries — the VoiceAgentCall row is the lock (conditional updateMany, like
 * PaycallCallRetry): attempt 1 two minutes after the call, then +3, +10, +30 min, +2 h (final).
 * Every attempt first makes sure a call that ended WITHOUT /book or /details has its lead +
 * "לחזור טלפונית" task (callbackDecision: not for a hidden number, not for a silent call under
 * 10 s) — so that never depends on the summary. Then Claude writes the summary into ONE lead
 * journal line (summaryCallLogId, updated in place). Final failure → ElevenLabs' own summary is
 * written instead + an alert to Or (voice_summary).
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
import { addLeadCallLog, appUrl, updateLeadCallLog } from "@/lib/alldog/leads";
import { heDayLabel } from "@/lib/alldog/time";
import { ensureCallbackTask, saveVoiceLead } from "@/lib/alldog/voice-agent/booking";
import {
  STALE_CALL_MS,
  callbackDecision,
  hasUserWords,
  nextSummaryAttemptAt,
  transcriptText,
  type CallbackDecision,
  type StoredTranscript,
} from "@/lib/alldog/voice-agent/end-rules";
import { formatVoiceLog, summarizeVoiceCall, type VoiceSummary } from "@/lib/alldog/voice-agent/summary";

const LOCK_MS = 5 * 60 * 1000;
const DAY_SECONDS = 24 * 60 * 60;

type CallRow = NonNullable<Awaited<ReturnType<typeof loadCall>>>;

function loadCall(id: string) {
  return prisma.voiceAgentCall.findUnique({
    where: { id },
    select: {
      id: true, businessId: true, providerConversationId: true, leadId: true, callerPhoneNorm: true, outcome: true,
      startedAt: true, durationSeconds: true, transcript: true, salesBrief: true, leadMeetingId: true,
      summaryAttempts: true, summaryCallLogId: true,
    },
  });
}

function storedTranscript(row: { transcript: unknown }): StoredTranscript {
  const t = (row.transcript ?? {}) as Partial<StoredTranscript>;
  return { turns: Array.isArray(t.turns) ? t.turns : [], omittedTurns: t.omittedTurns ?? 0, providerSummary: t.providerSummary ?? null, terminationReason: t.terminationReason ?? null };
}

/** Lead + "לחזור טלפונית" for a call that ended without /book or /details. Idempotent: once an outcome is set it is a no-op. */
export async function ensureFollowupForCall(row: CallRow, now: Date): Promise<CallbackDecision> {
  const t = storedTranscript(row);
  const decision = callbackDecision({ outcome: row.outcome, phoneNorm: row.callerPhoneNorm, durationSeconds: row.durationSeconds, userWords: hasUserWords(t.turns) });
  if (decision.open && row.callerPhoneNorm) {
    const { lead, displayName } = await saveVoiceLead(row.businessId, { conversationId: row.providerConversationId }, row.callerPhoneNorm, now);
    await ensureCallbackTask(row.businessId, lead.id, displayName, row.callerPhoneNorm, {});
    await prisma.voiceAgentCall.update({ where: { id: row.id }, data: { outcome: "hung_up_early", leadId: lead.id } });
  } else if (!row.outcome) {
    // Hidden number / silent short call: no task, but the outcome is recorded (it is not a real conversation).
    await prisma.voiceAgentCall.update({ where: { id: row.id }, data: { outcome: "hung_up_early" } });
  }
  return decision;
}

async function outcomeLine(row: CallRow, decision: CallbackDecision | null): Promise<string> {
  const rep = voiceAgentSettings().salesRepName;
  let booked: string | null = null;
  if (row.leadMeetingId) {
    const m = await prisma.leadMeeting.findFirst({ where: { id: row.leadMeetingId }, select: { date: true, startTime: true, status: true } });
    if (m) booked = `נקבעה שיחה טלפונית עם ${rep} ל${heDayLabel(m.date.toISOString().slice(0, 10))} בשעה ${m.startTime}${m.status === "canceled" ? " (בוטלה מאז)" : ""}`;
  }
  switch (row.outcome) {
    case "meeting_booked": return booked ?? "נקבעה שיחת מכירה";
    case "details_only": return "נאספו פרטים, בלי קביעה · לחזור טלפונית";
    case "urgent": return `דחוף · ${booked ?? "לחזור טלפונית בהקדם"}`;
    case "not_relevant": return "לא רלוונטי (לפי הסיכום)";
    case "hung_up_early":
      if (decision && !decision.open && decision.reason === "hidden_number") return "מספר חסוי · אין למי לחזור";
      if (decision && !decision.open && decision.reason === "silent_short_call") return "שיחה קצרה, המתקשר לא דיבר";
      return "השיחה הסתיימה בלי קביעה · לחזור טלפונית";
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
    dog: pick("dog", s.dog), breed: pick("breed", s.breed), age: pick("age", s.age), city: pick("city", s.city),
    problem: pick("problem", s.problem), urgency: pick("urgency", s.urgency), notes: pick("notes", s.notes),
  };
}

async function processOne(id: string, now: Date): Promise<"done" | "retry" | "final" | "skipped"> {
  const claim = await prisma.voiceAgentCall.updateMany({
    where: { id, summaryNextAt: { lte: now }, OR: [{ summaryLockedUntil: null }, { summaryLockedUntil: { lt: now } }] },
    data: { summaryLockedUntil: new Date(now.getTime() + LOCK_MS), summaryAttempts: { increment: 1 } },
  });
  if (claim.count === 0) return "skipped";
  let row = await loadCall(id);
  if (!row) return "skipped";
  let decision: CallbackDecision | null = null;
  try {
    decision = await ensureFollowupForCall(row, now);
    row = (await loadCall(id))!;
    const t = storedTranscript(row);
    if (!hasUserWords(t.turns)) {
      const text = formatVoiceLog({ startedAt: row.startedAt, durationSeconds: row.durationSeconds, summary: "המתקשר לא דיבר בשיחה.", outcomeLine: await outcomeLine(row, decision) });
      const logId = await writeJournal(row, text);
      await prisma.voiceAgentCall.update({ where: { id }, data: { summary: "המתקשר לא דיבר בשיחה.", summaryCallLogId: logId, summaryNextAt: null, summaryLockedUntil: null, summaryError: null } });
      return "done";
    }
    const s = await summarizeVoiceCall(transcriptText(t.turns), row.startedAt);
    if (!s) throw new Error("no usable summary (refusal / cut off / unparseable)");
    if (!s.relevant && row.outcome === "hung_up_early") {
      await prisma.voiceAgentCall.update({ where: { id }, data: { outcome: "not_relevant" } });
      row = (await loadCall(id))!;
    }
    const brief = mergedBrief(row.salesBrief, s);
    const text = formatVoiceLog({ startedAt: row.startedAt, durationSeconds: row.durationSeconds, summary: s.summary, ...brief, outcomeLine: await outcomeLine(row, decision) });
    const logId = await writeJournal(row, text);
    await prisma.voiceAgentCall.update({
      where: { id },
      data: { summary: s.summary, salesBrief: brief, summaryCallLogId: logId, summaryNextAt: null, summaryLockedUntil: null, summaryError: null },
    });
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
      const text = formatVoiceLog({
        startedAt: fresh.startedAt, durationSeconds: fresh.durationSeconds, summary: fallback,
        outcomeLine: await outcomeLine(fresh, decision),
        fallbackNote: "(סיכום אוטומטי של ElevenLabs — הסיכום הרגיל נכשל)",
      });
      const logId = await writeJournal(fresh, text);
      await prisma.voiceAgentCall.update({ where: { id }, data: { summary: fallback, summaryCallLogId: logId, summaryNextAt: null, summaryLockedUntil: null, summaryError: message } });
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
    where: { summaryNextAt: { lte: now }, OR: [{ summaryLockedUntil: null }, { summaryLockedUntil: { lt: now } }] },
    orderBy: { summaryNextAt: "asc" },
    take: opts.limit,
    select: { id: true },
  });
  const out = { processed: 0, done: 0, retry: 0, final: 0 };
  for (const { id } of due) {
    if (Date.now() - started > opts.budgetMs) break;
    const r = await processOne(id, now);
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
        await ensureCallbackTask(row.businessId, lead.id, displayName, row.callerPhoneNorm, {});
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
