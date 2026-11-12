/**
 * AllDog voice agent ("אלירן") — details only, no booking: lead (fill empty) + the existing
 * "לחזור טלפונית" task. `urgent: true` (bite) also sends the existing owner alert.
 *
 * POST { conversationId, callerPhone?, callbackPhone?, fullName?, dogName?, breed?, age?, city?, problem?, urgent?, urgentReason? }
 *   → { status: "saved" } | { status: "phone_required" }
 * Logic: src/lib/alldog/voice-agent/booking.ts. Auth: Bearer ALLDOG_VOICE_AGENT_SECRET.
 * Off (404) unless ALLDOG_VOICE_AGENT_ENABLED. Public route: /api/webhooks/ prefix, auth in-route.
 */
import { NextRequest, NextResponse } from "next/server";
import { allDogBusinessId, isVoiceAgentEnabled } from "@/lib/alldog/config";
import { verifyVoiceAgentSecret } from "@/lib/alldog/voice-agent/auth";
import { voiceLeadSchema } from "@/lib/alldog/voice-agent/schemas";
import { saveVoiceDetails } from "@/lib/alldog/voice-agent/booking";

export const dynamic = "force-dynamic";
// The response returns as soon as the lead + task are saved; the alerts after it (new-lead alert,
// urgent owner alert) run in waitUntil and are bounded by this limit, not by 15 s.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const businessId = allDogBusinessId();
  if (!isVoiceAgentEnabled() || !businessId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!verifyVoiceAgentSecret(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => undefined);
  const parsed = voiceLeadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const t0 = performance.now();
  try {
    const result = await saveVoiceDetails(businessId, parsed.data);
    console.log(`[alldog-voice details] conv=${parsed.data.conversationId} status=${result.status} total=${Math.round(performance.now() - t0)}ms`);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[alldog-voice details] failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
