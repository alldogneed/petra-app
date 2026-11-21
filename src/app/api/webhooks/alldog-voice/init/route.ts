/**
 * AllDog voice agent ("אלירן") — ElevenLabs conversation-initiation webhook: recognize the caller
 * BEFORE the agent speaks (src/lib/alldog/voice-agent/init.ts has the format and the docs).
 *
 * POST { caller_id, agent_id, called_number, call_sid, conversation_id, call_id? }
 *   → 200 { type: "conversation_initiation_client_data",
 *           dynamic_variables: { known, is_customer, first_name, dog_name, city, upcoming_meeting } }
 *
 * ALWAYS 200 with every variable: ElevenLabs may not start the call when this webhook fails. The
 * caller's details go back only with the right secret (Authorization: <ALLDOG_VOICE_AGENT_SECRET>,
 * with or without "Bearer "), the flag on, the right agent and a lookup inside its time budget —
 * anything else answers the empty set (an unknown caller) and, when it is a fault, alerts Or.
 * Same lookup as /start (identifyCaller); the call row is written after the response.
 * Public route: /api/webhooks/ prefix, auth in-route.
 */
import { NextRequest, NextResponse } from "next/server";
import { allDogBusinessId, isVoiceAgentEnabled } from "@/lib/alldog/config";
import { readEnv } from "@/lib/read-env";
import { runAfterResponse } from "@/lib/wait-until";
import { alertAllDogFailure } from "@/lib/alldog/failure-alerts";
import { verifyVoiceInitSecret } from "@/lib/alldog/voice-agent/auth";
import { identifyCaller, recordCallStart } from "@/lib/alldog/voice-agent/start";
import { INIT_LOOKUP_BUDGET_MS, emptyInitResponse, initResponseFrom, parseInitRequest, withBudget } from "@/lib/alldog/voice-agent/init";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const empty = (why: string) => {
  console.log(`[alldog-voice init] empty answer: ${why}`);
  return NextResponse.json(emptyInitResponse());
};

export async function POST(request: NextRequest) {
  try {
    const businessId = allDogBusinessId();
    if (!isVoiceAgentEnabled() || !businessId) return empty("voice agent off");
    if (!verifyVoiceInitSecret(request)) {
      await runAfterResponse(alertAllDogFailure({ kind: "voice_agent", error: "webhook תחילת שיחה (init) הגיע בלי הסוד הנכון — השיחה התחילה בלי זיהוי המתקשר" }));
      return empty("unauthorized");
    }
    const req = parseInitRequest(await request.json().catch(() => null));
    const agentId = readEnv("ALLDOG_VOICE_AGENT_ID");
    if (agentId && req.agentId && req.agentId !== agentId) return empty("other agent");

    const t0 = performance.now();
    const lookup = identifyCaller(businessId, req.callerPhone);
    const { value, timedOut } = await withBudget(lookup, INIT_LOOKUP_BUDGET_MS, null);
    const last4 = (req.callerPhone ?? "").replace(/\D/g, "").slice(-4) || "none";
    console.log(
      `[alldog-voice init] conv=${req.conversationId ?? "?"} caller=…${last4} known=${value?.result.known ?? "?"} ` +
        `total=${Math.round(performance.now() - t0)}ms${timedOut ? " TIMED OUT → empty answer" : value ? ` round1=${value.timings.round1Ms}ms round2=${value.timings.round2Ms}ms` : " lookup failed → empty answer"}`
    );
    if (!value) {
      await runAfterResponse(alertAllDogFailure({ kind: "voice_agent", error: timedOut ? `זיהוי המתקשר (init) לא הסתיים תוך ${INIT_LOOKUP_BUDGET_MS / 1000} שניות — השיחה התחילה בלי זיהוי` : "זיהוי המתקשר (init) נכשל — השיחה התחילה בלי זיהוי", phone: req.callerPhone ?? undefined }));
    }
    if (req.conversationId) {
      const conversationId = req.conversationId;
      // The call row is not needed for the answer. After a timeout the lookup is still awaited so the row gets its lead.
      await runAfterResponse(
        lookup.then((r) => r.activeLeadId, () => null).then((activeLeadId) =>
          recordCallStart(businessId, { conversationId, callerPhone: req.callerPhone, externalCallId: req.externalCallId }, activeLeadId)
        )
      );
    }
    return NextResponse.json(value ? initResponseFrom(value.result) : emptyInitResponse());
  } catch (e) {
    console.error("[alldog-voice init] failed", e instanceof Error ? e.message : e);
    return NextResponse.json(emptyInitResponse());
  }
}
