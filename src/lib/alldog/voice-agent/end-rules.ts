/**
 * AllDog voice agent — end-of-call webhook rules (pure — no DB).
 *
 * Signature: verified exactly like ElevenLabs' official SDK (elevenlabs-js `webhooks.constructEvent`,
 * read 12/11/2026): header `ElevenLabs-Signature: t=<unix seconds>,v0=<hex>`, HMAC-SHA256 with the
 * webhook secret over `${t}.${rawBody}`, lowercase hex, rejected when t is older than 30 minutes.
 * Differences on purpose: timing-safe compare, and any v0 entry may match (secret rotation).
 * Payload fields: docs "Post-call webhooks" (post_call_transcription). The caller's number comes from
 * dynamic_variables.system__caller_id ("Dynamic variables" docs) — to confirm on a real call.
 */
import { createHmac, timingSafeEqual } from "crypto";

export const SIGNATURE_TOLERANCE_MS = 30 * 60 * 1000;
/** Stored transcript cap (Or, 12/11/2026). Beyond it: the first and last halves + an "omitted" marker. */
export const TRANSCRIPT_MAX_CHARS = 50_000;
/** A call shorter than this in which the caller said nothing gets no callback task (Or). */
export const SILENT_CALL_MAX_SECONDS = 10;
/** First summary attempt 2 minutes after the call ends, so a /book that is still running finishes first. */
export const SUMMARY_FIRST_DELAY_MS = 2 * 60 * 1000;
/** Retry delays after attempt 1, 2, 3, 4 (same as the PayCall queue); attempt 5 is final. */
export const SUMMARY_RETRY_DELAYS_MIN = [3, 10, 30, 120] as const;
export const SUMMARY_MAX_ATTEMPTS = SUMMARY_RETRY_DELAYS_MIN.length + 1;
/** A call still "in_progress" this long after it started had no end-of-call webhook → failed + cleanup. */
export const STALE_CALL_MS = 60 * 60 * 1000;

export type SignatureCheck = { ok: true } | { ok: false; reason: "missing_header" | "malformed" | "too_old" | "mismatch" };

export function verifyElevenLabsSignature(rawBody: string, header: string | null, secret: string, nowMs: number = Date.now()): SignatureCheck {
  if (!header) return { ok: false, reason: "missing_header" };
  const parts = header.split(",").map((p) => p.trim());
  const t = parts.find((p) => p.startsWith("t="))?.slice(2);
  const sigs = parts.filter((p) => p.startsWith("v0="));
  if (!t || !/^\d+$/.test(t) || !sigs.length) return { ok: false, reason: "malformed" };
  if (Number(t) * 1000 < nowMs - SIGNATURE_TOLERANCE_MS) return { ok: false, reason: "too_old" };
  const expected = Buffer.from(`v0=${createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex")}`);
  const match = sigs.some((s) => {
    const got = Buffer.from(s);
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
  return match ? { ok: true } : { ok: false, reason: "mismatch" };
}

export interface TranscriptTurn { role: "agent" | "user"; message: string; t: number | null }

export interface ParsedPostCall {
  conversationId: string;
  agentId: string | null;
  startedAt: Date | null;
  durationSeconds: number | null;
  turns: TranscriptTurn[];
  callerPhone: string | null;
  externalCallId: string | null;
  terminationReason: string | null;
  providerSummary: string | null;
}

type Loose = Record<string, unknown>;
const obj = (v: unknown): Loose => (v && typeof v === "object" && !Array.isArray(v) ? (v as Loose) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** post_call_transcription → what we store. Null when it is not one, or has no conversation id. */
export function parsePostCall(payload: unknown): ParsedPostCall | null {
  const p = obj(payload);
  if (p.type !== "post_call_transcription") return null;
  const d = obj(p.data);
  const conversationId = str(d.conversation_id);
  if (!conversationId) return null;
  const meta = obj(d.metadata);
  const vars = obj(obj(d.conversation_initiation_client_data).dynamic_variables);
  const start = num(meta.start_time_unix_secs);
  const turns: TranscriptTurn[] = (Array.isArray(d.transcript) ? d.transcript : [])
    .map((x) => obj(x))
    .filter((x) => (x.role === "agent" || x.role === "user") && str(x.message))
    .map((x) => ({ role: x.role as "agent" | "user", message: String(x.message).trim(), t: num(x.time_in_call_secs) }));
  return {
    conversationId,
    agentId: str(d.agent_id),
    startedAt: start !== null ? new Date(start * 1000) : null,
    durationSeconds: num(meta.call_duration_secs) !== null ? Math.round(num(meta.call_duration_secs)!) : null,
    turns,
    callerPhone: str(vars.system__caller_id),
    externalCallId: str(vars.system__call_id) ?? str(vars.system__call_sid),
    terminationReason: str(meta.termination_reason),
    providerSummary: str(obj(d.analysis).transcript_summary),
  };
}

export interface StoredTranscript {
  turns: TranscriptTurn[];
  /** Turns dropped from the middle (0 = complete). The full transcript stays at ElevenLabs by conversation id. */
  omittedTurns: number;
  providerSummary: string | null;
  terminationReason: string | null;
}

/** Keep the whole transcript up to 50,000 characters; beyond it the first ~25k + last ~25k and a marker. */
export function capTranscript(turns: TranscriptTurn[], max: number = TRANSCRIPT_MAX_CHARS): { turns: TranscriptTurn[]; omittedTurns: number } {
  const total = turns.reduce((n, t) => n + t.message.length, 0);
  if (total <= max) return { turns, omittedTurns: 0 };
  const half = Math.floor(max / 2);
  const head: TranscriptTurn[] = [];
  let used = 0;
  for (const t of turns) {
    if (used + t.message.length > half) break;
    head.push(t);
    used += t.message.length;
  }
  const tail: TranscriptTurn[] = [];
  used = 0;
  for (let i = turns.length - 1; i >= head.length; i--) {
    if (used + turns[i].message.length > half) break;
    tail.unshift(turns[i]);
    used += turns[i].message.length;
  }
  const omitted = turns.length - head.length - tail.length;
  return { turns: [...head, { role: "agent", message: `… הושמטו ${omitted} תורים מאמצע השיחה …`, t: null }, ...tail], omittedTurns: omitted };
}

export function hasUserWords(turns: TranscriptTurn[]): boolean {
  return turns.some((t) => t.role === "user" && /[\p{L}\p{N}]/u.test(t.message));
}

/** "אלירן: …" / "מתקשר: …" lines for the summary model. */
export function transcriptText(turns: TranscriptTurn[]): string {
  return turns.map((t) => `${t.role === "agent" ? "אלירן" : "מתקשר"}: ${t.message}`).join("\n");
}

/**
 * A real conversation with Eliran = the caller booked, left details, or reported something urgent.
 * Section 6 blocks the automatic "missed call" WhatsApp only for these; hung_up_early / not_relevant
 * (and a call with no outcome) keep getting it.
 */
export const REAL_CONVERSATION_OUTCOMES = ["meeting_booked", "details_only", "urgent"] as const;
export function isRealVoiceConversation(outcome: string | null | undefined): boolean {
  return !!outcome && (REAL_CONVERSATION_OUTCOMES as readonly string[]).includes(outcome);
}

export type CallbackDecision =
  | { open: true }
  | { open: false; reason: "tool_outcome" | "hidden_number" | "silent_short_call" };

/**
 * A call that ended without /book or /details gets the "לחזור טלפונית" task — unless the number is
 * hidden, or it was shorter than 10 seconds and the caller said nothing.
 */
export function callbackDecision(c: {
  outcome: string | null;
  phoneNorm: string | null;
  durationSeconds: number | null;
  userWords: boolean;
}): CallbackDecision {
  if (c.outcome) return { open: false, reason: "tool_outcome" };
  if (!c.phoneNorm) return { open: false, reason: "hidden_number" };
  if (!c.userWords && (c.durationSeconds ?? 0) < SILENT_CALL_MAX_SECONDS) return { open: false, reason: "silent_short_call" };
  return { open: true };
}

/** Next attempt after `attempts` failed ones (1-based), or null when that was the final one. */
export function nextSummaryAttemptAt(attempts: number, now: Date): Date | null {
  const delay = SUMMARY_RETRY_DELAYS_MIN[attempts - 1];
  return delay === undefined ? null : new Date(now.getTime() + delay * 60 * 1000);
}
