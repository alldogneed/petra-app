/**
 * AllDog voice agent — the ElevenLabs "conversation initiation client data" webhook
 * (POST /api/webhooks/alldog-voice/init). ElevenLabs calls it when an inbound SIP / Twilio call
 * arrives, BEFORE the agent speaks, and puts the answer's `dynamic_variables` into the prompt — so
 * the caller is recognized without waiting on a tool call in the first turn.
 *
 * Docs read 21/11/2026 (Agents Platform → Personalization, Twilio personalization, Dynamic variables):
 *   request  POST JSON { caller_id, agent_id, called_number, call_sid, conversation_id } (+ call_id,
 *            sip_headers on SIP calls);
 *   response { type: "conversation_initiation_client_data", dynamic_variables: {…} } — it must carry
 *            EVERY custom dynamic variable the agent defines; values are strings / numbers / booleans;
 *   "A failed or timed-out webhook can prevent the conversation from starting." — so this webhook
 *   ALWAYS answers 200 with the full variable set, empty when anything is wrong (emptyInitResponse),
 *   and the lookup has its own time budget. Pure helpers here; the route does the I/O.
 */
import type { VoiceStartResult } from "@/lib/alldog/voice-agent/start";

/** The lookup may take this long; after it the call starts without recognition. */
export const INIT_LOOKUP_BUDGET_MS = 2000;

/** Exactly the custom dynamic variables to define on the agent in ElevenLabs. */
export interface VoiceInitVariables {
  known: boolean;
  is_customer: boolean;
  first_name: string;
  dog_name: string;
  city: string;
  upcoming_meeting: string;
}

export interface VoiceInitResponse {
  type: "conversation_initiation_client_data";
  dynamic_variables: VoiceInitVariables;
}

export const EMPTY_INIT_VARIABLES: VoiceInitVariables = { known: false, is_customer: false, first_name: "", dog_name: "", city: "", upcoming_meeting: "" };

function respond(v: VoiceInitVariables): VoiceInitResponse {
  return { type: "conversation_initiation_client_data", dynamic_variables: v };
}

/** The call starts as an unknown caller. */
export function emptyInitResponse(): VoiceInitResponse {
  return respond({ ...EMPTY_INIT_VARIABLES });
}

/** A missing value is "" (never null) — every variable is always present. */
export function initResponseFrom(r: VoiceStartResult): VoiceInitResponse {
  return respond({
    known: r.known,
    is_customer: r.isCustomer,
    first_name: r.firstName ?? "",
    dog_name: r.dogName ?? "",
    city: r.city ?? "",
    upcoming_meeting: r.upcomingMeeting?.label ?? "",
  });
}

export interface VoiceInitRequest {
  conversationId: string | null;
  callerPhone: string | null;
  agentId: string | null;
  externalCallId: string | null;
}

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Lenient: any shape is accepted, unknown fields ignored — a bad body still gets a valid answer. */
export function parseInitRequest(body: unknown): VoiceInitRequest {
  const b = (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  return {
    conversationId: str(b.conversation_id, 200),
    callerPhone: str(b.caller_id, 50),
    agentId: str(b.agent_id, 200),
    externalCallId: str(b.call_id, 200) ?? str(b.call_sid, 200),
  };
}

/** `work`, or `fallback` when it takes longer than `ms` (the work keeps running; its result is dropped). */
export function withBudget<T>(work: Promise<T>, ms: number, fallback: T): Promise<{ value: T; timedOut: boolean }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ value: fallback, timedOut: true }), ms);
    work.then(
      (value) => { clearTimeout(timer); resolve({ value, timedOut: false }); },
      () => { clearTimeout(timer); resolve({ value: fallback, timedOut: false }); },
    );
  });
}
