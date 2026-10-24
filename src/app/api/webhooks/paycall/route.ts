export const dynamic = "force-dynamic";
// Answered calls are transcribed + summarized after the response (AllDog only) — needs headroom.
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getCallById,
  isMissedCall,
  isSummarizableAnswer,
  parseLiveLinkParams,
  processMissedCall,
  type LiveLinkParams,
} from "@/lib/paycall";
import { runAfterResponse } from "@/lib/wait-until";
import { isCallSummariesEnabled } from "@/lib/alldog/config";
import { readEnv } from "@/lib/read-env";

/**
 * GET /api/webhooks/paycall
 *
 * PayCall sends two GETs per call (Status=START and Status=END). We only act on
 * END events with a non-ANSWER disposition. Auth is via ?secret=<PAYCALL_WEBHOOK_SECRET>
 * since PayCall only supports query-string auth (no custom headers).
 *
 * Required query params (per PayCall API spec, section "Real-time Alert"):
 *   Status:     "START" | "UPDATE" | "END"
 *   Id:         numeric call ID
 *   Disposition (END only): ANSWER | NOANSWER | CANCEL | BUSY | ...
 * liveLink extras (when configured in the PayCall portal): Cli, billsec, dlink / dlinkDirect,
 * Gclid, campaign* — used for answered calls (see src/lib/alldog/call-summary.ts).
 *
 * Answered calls (ANSWER, billsec ≥ 20) are summarized ONLY when ALLDOG_CALL_SUMMARIES_ENABLED
 * is on; PayCall gets its 200 right away and the work runs after the response.
 */
export async function GET(request: NextRequest) {
  const expected = readEnv("PAYCALL_WEBHOOK_SECRET");
  if (!expected) {
    console.error("[paycall webhook] PAYCALL_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }
  const provided = request.nextUrl.searchParams.get("secret") || "";
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const live = parseLiveLinkParams(request.nextUrl.searchParams);
  const status = live.status;
  const callId = live.callId;
  const disposition = live.disposition;

  // Only process END events; START is informational
  if (status !== "END") {
    return NextResponse.json({ ok: true, ignored: status });
  }
  if (!callId) {
    return NextResponse.json({ error: "Missing Id" }, { status: 400 });
  }

  // Answered call: summarized in the background for AllDog, otherwise ignored as before.
  if (disposition && disposition === "ANSWER") {
    if (isCallSummariesEnabled() && isSummarizableAnswer(live)) {
      await runAfterResponse(summarizeAnsweredCall(callId, live));
      return NextResponse.json({ ok: true, queued: "answered_summary", callId });
    }
    return NextResponse.json({ ok: true, ignored: "answered" });
  }

  // Fetch full call detail (we need CALLERID + START which the webhook doesn't include)
  let call;
  try {
    call = await getCallById(callId);
  } catch (err) {
    console.error("[paycall webhook] getCallById error:", err);
    return NextResponse.json({ error: "lookup_failed" }, { status: 502 });
  }
  if (!call) {
    return NextResponse.json({ ok: true, ignored: "call_not_found", callId });
  }
  if (!isMissedCall(call)) {
    return NextResponse.json({ ok: true, ignored: "answered_after_lookup", callId });
  }

  try {
    const result = await processMissedCall(call);
    // Item 32 (AllDog, flag ALLDOG_MISSED_CALL_WA_ENABLED): automatic WhatsApp to the caller, after the response.
    if (!result.skipped) {
      const { isMissedCallWaEnabled } = await import("@/lib/alldog/missed-call-rules");
      if (isMissedCallWaEnabled()) {
        const { scheduleMissedCallWhatsApp } = await import("@/lib/alldog/missed-call-wa");
        await runAfterResponse(scheduleMissedCallWhatsApp(call, { leadId: result.leadId }).then(() => undefined));
      }
    }
    return NextResponse.json({ ok: true, callId, ...result });
  } catch (err) {
    console.error("[paycall webhook] processMissedCall error:", err);
    return NextResponse.json({ error: "process_failed" }, { status: 500 });
  }
}

/** Background: fill phone / start time from the API when the liveLink did not carry them, then summarize. */
async function summarizeAnsweredCall(callId: string, live: LiveLinkParams): Promise<void> {
  try {
    let phone = live.cli;
    let startedAt = new Date(Date.now() - (live.billsec ?? 0) * 1000);
    const details = await getCallById(callId).catch(() => null);
    if (details) {
      phone = phone ?? details.CALLERID;
      startedAt = new Date(details.START.replace(" ", "T") + "+03:00");
      if (isNaN(startedAt.getTime())) startedAt = new Date(Date.now() - (live.billsec ?? 0) * 1000);
    }
    if (!phone) {
      console.warn(`[paycall webhook] answered call ${callId}: no caller phone — left for the daily sync`);
      return;
    }
    // First attempt through the retry queue: if the recording is not ready yet, the lead shows a
    // "summary pending" line now and /api/cron/alldog-call-retry tries again at +3/+10/+30 min/+2 h.
    const { runAnsweredCall } = await import("@/lib/alldog/call-retry");
    const result = await runAnsweredCall(
      {
        callId,
        phone,
        startedAt,
        billsec: live.billsec,
        recordingUrl: live.recordingUrl,
        gclid: live.gclid,
        campaign: live.campaign,
        campaignParams: live.campaignParams,
      }
    );
    console.log(`[paycall webhook] answered call ${callId}: ${result.status}`);
  } catch (err) {
    console.error(`[paycall webhook] answered call ${callId} failed:`, err instanceof Error ? err.message : err);
  }
}
