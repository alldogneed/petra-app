/**
 * AllDog voice agent ("אלירן", ElevenLabs) — call start. The agent calls this once when it picks up.
 *
 * POST { conversationId, callerPhone?, externalCallId? }
 *   → { known, isCustomer, returning, name, dogName, stage, upcomingMeeting, whatsappSummary, slots[6] }
 *
 * Auth: Authorization: Bearer <ALLDOG_VOICE_AGENT_SECRET> (src/lib/alldog/voice-agent/auth.ts).
 * Off (404) unless ALLDOG_VOICE_AGENT_ENABLED + ALLDOG_BUSINESS_ID + the secret are set.
 * Public route: the /api/webhooks/ prefix is exempt from session auth in middleware.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { allDogBusinessId, isVoiceAgentEnabled } from "@/lib/alldog/config";
import { verifyVoiceAgentSecret } from "@/lib/alldog/voice-agent/auth";
import { startVoiceCall } from "@/lib/alldog/voice-agent/start";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const bodySchema = z.object({
  conversationId: z.string().trim().min(1).max(200),
  callerPhone: z.string().max(50).nullish(),
  externalCallId: z.string().max(200).nullish(),
});

export async function POST(request: NextRequest) {
  const businessId = allDogBusinessId();
  if (!isVoiceAgentEnabled() || !businessId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!verifyVoiceAgentSecret(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  try {
    const { result, timings } = await startVoiceCall(businessId, parsed.data);
    const last4 = (parsed.data.callerPhone ?? "").replace(/\D/g, "").slice(-4) || "none";
    console.log(
      `[alldog-voice start] conv=${parsed.data.conversationId} caller=…${last4} known=${result.known} ` +
        `slots=${result.slots.length} round1=${timings.round1Ms}ms round2=${timings.round2Ms}ms total=${timings.totalMs}ms`
    );
    return NextResponse.json(result, {
      headers: { "Server-Timing": `db1;dur=${timings.round1Ms}, db2;dur=${timings.round2Ms}, total;dur=${timings.totalMs}` },
    });
  } catch (e) {
    console.error("[alldog-voice start] failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
