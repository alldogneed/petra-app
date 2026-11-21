/**
 * AllDog voice agent — machine-to-machine auth for the ElevenLabs tool calls.
 * `Authorization: Bearer <ALLDOG_VOICE_AGENT_SECRET>`, timing-safe compare (same pattern as
 * verifyCronAuth). Fails closed: no secret configured → every request is refused.
 */
import { timingSafeEqual } from "crypto";
import { readEnv } from "@/lib/read-env";

/**
 * The conversation-initiation webhook: ElevenLabs sends the workspace secret chosen for the webhook
 * as a header value, so `Authorization: <secret>` is accepted as well as `Authorization: Bearer <secret>`.
 */
export function verifyVoiceInitSecret(request: Request): boolean {
  const secret = readEnv("ALLDOG_VOICE_AGENT_SECRET");
  if (!secret) return false;
  const header = (request.headers.get("authorization") ?? "").trim();
  const value = header.startsWith("Bearer ") ? header.slice(7).trim() : header;
  if (!value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The tool calls (/start, /details, /book). ElevenLabs sends a tool's secret header as the raw
 * value, so both `Authorization: Bearer <secret>` and `Authorization: <secret>` are accepted — the
 * same timing-safe check as /init.
 */
export function verifyVoiceAgentSecret(request: Request): boolean {
  return verifyVoiceInitSecret(request);
}
