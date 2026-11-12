/**
 * AllDog voice agent ("אלירן") — book a 20-minute phone sales call with Racheli (LeadMeeting).
 *
 * POST { conversationId, startsAt, callerPhone?, callbackPhone?, fullName?, dogName?, breed?, age?, city?, problem?, urgent?, urgentReason? }
 *   → { status: "booked", meeting, alreadyBooked?, stageChanged }
 *   | { status: "already_has_meeting", alreadyHasMeeting: true, meeting }
 *   | { status: "slot_taken" | "invalid_slot", reason?, alternatives[3] }
 *   | { status: "existing_customer" } | { status: "phone_required" }
 * Logic: src/lib/alldog/voice-agent/booking.ts. Auth: Bearer ALLDOG_VOICE_AGENT_SECRET.
 * Off (404) unless ALLDOG_VOICE_AGENT_ENABLED. Public route: /api/webhooks/ prefix, auth in-route.
 */
import { NextRequest, NextResponse } from "next/server";
import { allDogBusinessId, isVoiceAgentEnabled } from "@/lib/alldog/config";
import { verifyVoiceAgentSecret } from "@/lib/alldog/voice-agent/auth";
import { voiceBookSchema } from "@/lib/alldog/voice-agent/schemas";
import { bookSalesCall } from "@/lib/alldog/voice-agent/booking";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(request: NextRequest) {
  const businessId = allDogBusinessId();
  if (!isVoiceAgentEnabled() || !businessId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!verifyVoiceAgentSecret(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => undefined);
  const parsed = voiceBookSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const t0 = performance.now();
  try {
    const result = await bookSalesCall(businessId, parsed.data);
    console.log(`[alldog-voice book] conv=${parsed.data.conversationId} status=${result.status} total=${Math.round(performance.now() - t0)}ms`);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[alldog-voice book] failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
