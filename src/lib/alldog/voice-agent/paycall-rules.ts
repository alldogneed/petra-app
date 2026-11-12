/**
 * AllDog voice agent × PayCall — pure rules (no DB). Section 6, status "ממתין לשיחה אמיתית":
 * what PayCall reports for a call it forwarded to Eliran's Telnyx number is NOT known from the code
 * (ANSWER or a missed disposition, and when its END arrives). These rules cover both; the log lines
 * (paycall-guard.ts) let us check them on the first real forwarded call.
 *
 *  1. Answered-call summaries: a call whose CALLEE is the Telnyx number is not downloaded,
 *     transcribed or summarized (ElevenLabs already sends its transcript).
 *  2. The automatic "missed call" WhatsApp is blocked only after a REAL conversation with Eliran
 *     (isRealVoiceConversation: booked / details / urgent) from the same caller:
 *       real outcome (even while the call is still "in progress") → blocked at once;
 *       call still in progress, no real outcome, < 15 min since it started → deferred (re-checked);
 *       anything else (ended without a real outcome, still "in progress" after 15 min, no call) → sent.
 */
import { isRealVoiceConversation } from "@/lib/alldog/voice-agent/end-rules";

/** A voice call belongs to a PayCall call when it started from 2 min before to 15 min after the PayCall START. */
export const VOICE_MATCH_BEFORE_MS = 2 * 60 * 1000;
export const VOICE_MATCH_AFTER_MS = 15 * 60 * 1000;
/** Cap on waiting for an in-progress voice call (Or, 12/11/2026): 15 minutes from its start. */
export const VOICE_WA_MAX_WAIT_MS = 15 * 60 * 1000;
/** A deferred WhatsApp is checked again after this long (the queue runs every 5 minutes). */
export const VOICE_WA_DEFER_MS = 5 * 60 * 1000;
/**
 * The first voice-agent check of a missed-call WhatsApp runs at least 2 minutes after the PayCall event
 * (Or, 12/11/2026). Without it the WhatsApp left within seconds — if PayCall reports "missed" at the
 * forward (second 20), the check would run before /start created the voice call and find "no call".
 */
export const VOICE_WA_MIN_DELAY_MS = 2 * 60 * 1000;

/** When the WhatsApp may first be checked: the later of its normal send time and event + 2 minutes. */
export function firstVoiceCheckAt(normalSendAt: Date, eventAt: Date): Date {
  const min = eventAt.getTime() + VOICE_WA_MIN_DELAY_MS;
  return normalSendAt.getTime() >= min ? normalSendAt : new Date(min);
}

/** Israeli number in any spelling (+972…, 972…, 03…, with dashes) → "0XXXXXXXX(X)"; "" when empty. */
export function normalizeIlNumber(raw: string | null | undefined): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00972")) d = d.slice(5);
  else if (d.startsWith("972")) d = d.slice(3);
  return d.startsWith("0") ? d : `0${d}`;
}

/** PayCall's CALLEE is the voice agent's Telnyx number. False when either is missing. */
export function isVoiceAgentLeg(callee: string | null | undefined, agentNumber: string | null | undefined): boolean {
  const a = normalizeIlNumber(callee);
  const b = normalizeIlNumber(agentNumber);
  return a.length >= 9 && a === b;
}

export interface VoiceCallState {
  status: string;               // in_progress | ended | failed
  outcome: string | null;
  startedAt: Date;              // VoiceAgentCall.startedAt ?? createdAt
}

export type MissedCallVoiceDecision =
  | { action: "block"; reason: "voice_agent_conversation" }
  | { action: "defer"; reason: "voice_call_in_progress"; until: Date }
  | { action: "send"; reason: "no_voice_call" | "no_real_conversation" | "voice_wait_cap" };

export function missedCallVoiceDecision(calls: VoiceCallState[], now: Date): MissedCallVoiceDecision {
  if (calls.some((c) => isRealVoiceConversation(c.outcome))) return { action: "block", reason: "voice_agent_conversation" };
  if (!calls.length) return { action: "send", reason: "no_voice_call" };
  const open = calls.filter((c) => c.status === "in_progress" && now.getTime() - c.startedAt.getTime() < VOICE_WA_MAX_WAIT_MS);
  if (open.length) return { action: "defer", reason: "voice_call_in_progress", until: new Date(now.getTime() + VOICE_WA_DEFER_MS) };
  const capped = calls.some((c) => c.status === "in_progress");
  return { action: "send", reason: capped ? "voice_wait_cap" : "no_real_conversation" };
}

/** What processMissedCall wrote — for the verification log (Or: show whether the "שיחה שלא נענתה" lead line was written). */
export function missedCallWriteLabel(r: { skipped: boolean; customerId?: string | null; leadId?: string | null }): string {
  if (r.customerId) return r.skipped ? "customer-note-existed" : "customer-note";
  if (r.skipped) return "already-handled";
  return "lead-line-written";
}

/** One verification line per PayCall call while the voice agent is active. Caller: last 4 digits only. */
export function paycallVoiceLogLine(p: {
  source: "webhook" | "sync";
  callId: string;
  disposition: string | null | undefined;
  callee: string | null | undefined;
  agentNumber: string | null;
  duration: string | number | null | undefined;
  billsec: number | null | undefined;
  caller: string | null | undefined;
  extra?: string;
}): string {
  const last4 = (p.caller ?? "").replace(/\D/g, "").slice(-4) || "?";
  return (
    `[paycall voice-agent] ${p.source} call ${p.callId}: disposition=${p.disposition ?? "?"} ` +
    `callee=${normalizeIlNumber(p.callee) || "?"} voiceAgentLeg=${isVoiceAgentLeg(p.callee, p.agentNumber)} ` +
    `duration=${p.duration ?? "?"} billsec=${p.billsec ?? "?"} caller=…${last4}${p.extra ? ` ${p.extra}` : ""}`
  );
}
