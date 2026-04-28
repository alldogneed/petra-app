export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getCallById, isMissedCall, processMissedCall } from "@/lib/paycall";

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
 */
export async function GET(request: NextRequest) {
  const expected = process.env.PAYCALL_WEBHOOK_SECRET;
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

  const status = request.nextUrl.searchParams.get("Status");
  const callId = request.nextUrl.searchParams.get("Id");
  const disposition = request.nextUrl.searchParams.get("Disposition");

  // Only process END events; START is informational
  if (status !== "END") {
    return NextResponse.json({ ok: true, ignored: status });
  }
  if (!callId) {
    return NextResponse.json({ error: "Missing Id" }, { status: 400 });
  }

  // If disposition was passed inline and it's an answered call, short-circuit
  if (disposition && disposition === "ANSWER") {
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
    return NextResponse.json({ ok: true, callId, ...result });
  } catch (err) {
    console.error("[paycall webhook] processMissedCall error:", err);
    return NextResponse.json({ error: "process_failed" }, { status: 500 });
  }
}
