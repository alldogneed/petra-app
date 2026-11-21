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

export function verifyVoiceAgentSecret(request: Request): boolean {
  const secret = readEnv("ALLDOG_VOICE_AGENT_SECRET");
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
