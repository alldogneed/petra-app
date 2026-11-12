/**
 * AllDog voice agent ("אלירן") — ElevenLabs end-of-call webhook (post_call_transcription).
 *
 * Auth: `ElevenLabs-Signature` (t=…,v0=…) HMAC-SHA256 over `${t}.${rawBody}` with
 * ALLDOG_VOICE_WEBHOOK_SECRET — verifyElevenLabsSignature (end-rules.ts, same algorithm as the
 * official SDK). Secret missing → 503 + alert (fail closed). Bad signature → 401 + alert (not retried
 * by ElevenLabs). Optional ALLDOG_VOICE_AGENT_ID: payloads of any other agent are ignored.
 * Stores the call and returns 200 at once; the summary runs from the cron (summary-job.ts).
 * Other event types (post_call_audio, call_initiation_failure) → 200, ignored.
 * Off (404) unless ALLDOG_VOICE_AGENT_ENABLED. Public route: /api/webhooks/ prefix, auth in-route.
 */
import { NextRequest, NextResponse } from "next/server";
import { allDogBusinessId, isVoiceAgentEnabled } from "@/lib/alldog/config";
import { readEnv } from "@/lib/read-env";
import { runAfterResponse } from "@/lib/wait-until";
import { alertAllDogFailure } from "@/lib/alldog/failure-alerts";
import { parsePostCall, verifyElevenLabsSignature } from "@/lib/alldog/voice-agent/end-rules";
import { recordCallEnd } from "@/lib/alldog/voice-agent/end";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const businessId = allDogBusinessId();
  if (!isVoiceAgentEnabled() || !businessId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const secret = readEnv("ALLDOG_VOICE_WEBHOOK_SECRET");
  if (!secret) {
    await runAfterResponse(alertAllDogFailure({ kind: "voice_agent", error: "ALLDOG_VOICE_WEBHOOK_SECRET חסר — webhook סוף שיחה נדחה (503)" }));
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const raw = await request.text();
  const sig = verifyElevenLabsSignature(raw, request.headers.get("elevenlabs-signature"), secret);
  if (!sig.ok) {
    console.warn(`[alldog-voice end] signature rejected: ${sig.reason}`);
    await runAfterResponse(alertAllDogFailure({ kind: "voice_agent", error: `חתימה לא תקינה (ElevenLabs-Signature: ${sig.reason}) — webhook סוף שיחה נדחה (401)` }));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = parsePostCall(payload);
  if (!parsed) {
    const type = (payload as { type?: unknown } | null)?.type;
    return NextResponse.json({ ok: true, ignored: typeof type === "string" ? type : "unknown" });
  }
  const agentId = readEnv("ALLDOG_VOICE_AGENT_ID");
  if (agentId && parsed.agentId !== agentId) return NextResponse.json({ ok: true, ignored: "other_agent" });

  try {
    const { created } = await recordCallEnd(businessId, parsed);
    const last4 = (parsed.callerPhone ?? "").replace(/\D/g, "").slice(-4) || "none";
    console.log(`[alldog-voice end] conv=${parsed.conversationId} caller=…${last4} duration=${parsed.durationSeconds ?? "?"}s turns=${parsed.turns.length} new=${created}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[alldog-voice end] failed", e instanceof Error ? e.message : e);
    await runAfterResponse(alertAllDogFailure({ kind: "voice_agent", error: e, phone: parsed.callerPhone ?? undefined }));
    return NextResponse.json({ error: "internal_error" }, { status: 500 }); // 5xx → ElevenLabs retries (when enabled)
  }
}
