/**
 * AllDog voice agent × PayCall — the hooks used by the PayCall webhook, paycall-sync and the
 * missed-call WhatsApp (rules: paycall-rules.ts). Everything is a no-op unless
 * voiceAgentActiveFor(PAYCALL_BUSINESS_ID) — with the flag off PayCall behaves exactly as before.
 * Status: "ממתין לשיחה אמיתית" until one real forwarded call has been checked against these logs.
 */
import prisma from "@/lib/prisma";
import { claimOnce } from "@/lib/rate-limit";
import { readEnv } from "@/lib/read-env";
import { notifyOwnerAllDog } from "@/lib/notify-owner";
import { voiceAgentActiveFor, voiceAgentSettings } from "@/lib/alldog/config";
import {
  VOICE_MATCH_AFTER_MS,
  VOICE_MATCH_BEFORE_MS,
  firstVoiceCheckAt,
  isVoiceAgentLeg,
  missedCallVoiceDecision,
  normalizeIlNumber,
  paycallVoiceLogLine,
  type MissedCallVoiceDecision,
} from "@/lib/alldog/voice-agent/paycall-rules";

const DAY_SECONDS = 24 * 60 * 60;

/** The voice agent is active for the PayCall business (PAYCALL_BUSINESS_ID). */
export function voiceGuardActive(): boolean {
  return voiceAgentActiveFor(readEnv("PAYCALL_BUSINESS_ID"));
}

/** The Telnyx number, or null (→ no filtering) with a log warning + a daily alert to Or. */
export async function voiceAgentNumberOrWarn(): Promise<string | null> {
  const n = voiceAgentSettings().voiceAgentNumber;
  if (n && normalizeIlNumber(n).length >= 9) return n;
  console.warn("[paycall voice-agent] ALLDOG_VOICE_AGENT_NUMBER is not set — PayCall summaries are NOT filtered (behaves as before)");
  if (await claimOnce("alldog-voice-agent-number-missing", DAY_SECONDS)) {
    await notifyOwnerAllDog({
      title: "מספר ה-Telnyx של אלירן לא מוגדר",
      lines: [
        "הסוכן הקולי פעיל, אבל ALLDOG_VOICE_AGENT_NUMBER לא מוגדר.",
        "לכן שיחות שאלירן ענה עליהן עלולות להיות מתומללות ומסוכמות גם בצינור של PayCall (כפילות). ההתראה נשלחת פעם ביום.",
      ],
    }).catch((err) => console.error("[paycall voice-agent] alert failed", err));
  }
  return null;
}

interface PaycallCallLike {
  ID: string;
  CALLERID?: string | null;
  CALLEE?: string | null;
  DISPOSITION?: string | null;
  DURATION?: string | number | null;
}

/**
 * Answered-call summaries (webhook + sync): true = this call went to Eliran → skip it (not downloaded,
 * transcribed or summarized). Always logs one verification line while the guard is active.
 */
export async function skipPaycallSummaryForVoiceAgent(
  call: PaycallCallLike,
  source: "webhook" | "sync",
  billsec: number | null
): Promise<boolean> {
  if (!voiceGuardActive()) return false;
  const number = await voiceAgentNumberOrWarn();
  const skip = !!number && isVoiceAgentLeg(call.CALLEE, number);
  // paycall-sync re-reads 48 h every 10 minutes → its line is logged once per call.
  if (source === "sync" && !(await claimOnce(`alldog-voice-sync-log:${call.ID}`, 3 * DAY_SECONDS))) return skip;
  console.log(paycallVoiceLogLine({
    source, callId: call.ID, disposition: call.DISPOSITION, callee: call.CALLEE, agentNumber: number,
    duration: call.DURATION, billsec, caller: call.CALLERID, extra: skip ? "summary=skipped(voice-agent)" : "summary=normal",
  }));
  return skip;
}

/** Missed path (webhook): one verification line, including what processMissedCall wrote to the lead. */
export async function logMissedCallForVoiceAgent(call: PaycallCallLike, written: string): Promise<void> {
  if (!voiceGuardActive()) return;
  console.log(paycallVoiceLogLine({
    source: "webhook", callId: call.ID, disposition: call.DISPOSITION, callee: call.CALLEE,
    agentNumber: voiceAgentSettings().voiceAgentNumber, duration: call.DURATION, billsec: null, caller: call.CALLERID,
    extra: `missed=${written}`,
  }));
}

/**
 * Missed-call WhatsApp scheduling: with the voice agent active AND the Telnyx number set, the send is
 * held until at least 2 minutes after the PayCall event (the queue then picks it up, every 5 minutes).
 * Otherwise the normal send time, exactly as before.
 */
export async function missedCallSendAt(normalSendAt: Date, eventAt: Date): Promise<Date> {
  if (!voiceGuardActive()) return normalSendAt;
  if (!(await voiceAgentNumberOrWarn())) return normalSendAt;
  return firstVoiceCheckAt(normalSendAt, eventAt);
}

/** Once a day: the liveLink parameter NAMES (no values) — is there a field that tells a forwarded call apart? */
export async function logLiveLinkKeysOnce(keys: string[]): Promise<void> {
  if (!voiceGuardActive()) return;
  if (!(await claimOnce("alldog-voice-paycall-livelink-keys", DAY_SECONDS))) return;
  console.log(`[paycall voice-agent] liveLink parameter names: ${Array.from(new Set(keys)).sort().join(", ")}`);
}

/**
 * The automatic "missed call" WhatsApp: block / defer / send, by the caller's conversation with Eliran
 * that started from 2 min before to 15 min after the PayCall call.
 */
export async function missedCallVoiceCheck(
  businessId: string,
  mobile: string,
  callStart: Date | null,
  now: Date = new Date()
): Promise<MissedCallVoiceDecision | null> {
  if (!voiceAgentActiveFor(businessId)) return null;
  const phone = normalizeIlNumber(mobile);
  const anchor = callStart ?? now;
  const rows = await prisma.voiceAgentCall.findMany({
    where: {
      businessId,
      callerPhoneNorm: phone,
      createdAt: { gte: new Date(anchor.getTime() - VOICE_MATCH_BEFORE_MS), lte: new Date(anchor.getTime() + VOICE_MATCH_AFTER_MS) },
    },
    select: { status: true, outcome: true, startedAt: true, createdAt: true },
    take: 5,
  });
  return missedCallVoiceDecision(rows.map((r) => ({ status: r.status, outcome: r.outcome, startedAt: r.startedAt ?? r.createdAt })), now);
}
