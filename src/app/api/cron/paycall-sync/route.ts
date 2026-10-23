export const dynamic = "force-dynamic";
// Answered calls (AllDog) are transcribed + summarized here as a safety net — needs headroom.
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { probeAnalyticsCallsShape, getCalls, isMissedCall, processMissedCall, MIN_SUMMARY_BILLSEC, type PaycallCall } from "@/lib/paycall";
import { isCallSummariesEnabled } from "@/lib/alldog/config";

/**
 * GET /api/cron/paycall-sync
 *
 * Backfill missed-call leads from PayCall. Pulls calls from the last 24 hours,
 * filters for missed dispositions, and processes each one. Idempotent — already
 * processed calls (matching call_id in CallLog summary) are skipped.
 *
 * When ALLDOG_CALL_SUMMARIES_ENABLED is on, the window is 48 hours and answered calls
 * (≥ 20s talk time) the webhook missed are summarized too (src/lib/alldog/call-summary.ts),
 * within a time budget; a call seen for the second time is a final attempt (logged even
 * without a summary). gclid / campaign are not filled here yet: getAnalyticsCalls is only probed
 * (its key names logged once, no values) until the real field names are confirmed.
 *
 * Acts as a safety net behind the realtime webhook. Authentication via cron
 * secret (Authorization: Bearer or x-cron-secret header).
 */
const ANSWERED_BUDGET_MS = 230_000;

function billsecOf(call: PaycallCall): number {
  const end = Date.parse(call.END.replace(" ", "T") + "+03:00");
  const ans = call.ANS_TIME ? Date.parse(call.ANS_TIME.replace(" ", "T") + "+03:00") : NaN;
  if (!isNaN(end) && !isNaN(ans) && end >= ans) return Math.round((end - ans) / 1000);
  return Number(call.DURATION) || 0;
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startedRun = Date.now();
    const now = new Date();
    const summaries = isCallSummariesEnabled();
    const fromDate = new Date(now.getTime() - (summaries ? 48 : 24) * 60 * 60 * 1000);
    const calls = await getCalls({ fromDate, toDate: now, limit: 500 });
    const missed = calls.filter(isMissedCall);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const call of missed) {
      try {
        const r = await processMissedCall(call);
        if (r.skipped) skipped++;
        else if (r.created) created++;
        else updated++;
      } catch (err) {
        errors.push(`${call.ID}: ${(err as Error).message}`);
      }
    }

    // ── Answered calls (AllDog summaries) ──
    const answeredStats = { candidates: 0, logged: 0, duplicate: 0, deferred: 0, notReached: 0 };
    let analyticsShape: string | null = null;
    if (summaries) {
      analyticsShape = await probeAnalyticsCallsShape({ fromDate, toDate: now });
      const answered = calls.filter((c) => c.DISPOSITION === "ANSWER" && billsecOf(c) >= MIN_SUMMARY_BILLSEC && c.CALLERID);
      answeredStats.candidates = answered.length;
      if (answered.length) {
        const { processAnsweredCall } = await import("@/lib/alldog/call-summary");
        for (const call of answered) {
          if (Date.now() - startedRun > ANSWERED_BUDGET_MS) {
            answeredStats.notReached++;
            continue;
          }
          try {
            const startedAt = new Date(call.START.replace(" ", "T") + "+03:00");
            const r = await processAnsweredCall(
              {
                callId: call.ID,
                phone: call.CALLERID,
                startedAt,
                billsec: billsecOf(call),
              },
              // Seen by a previous daily run already → last chance, log even without a summary.
              { finalAttempt: now.getTime() - startedAt.getTime() > 22 * 60 * 60 * 1000 }
            );
            if (r.status === "logged") answeredStats.logged++;
            else if (r.status === "duplicate") answeredStats.duplicate++;
            else answeredStats.deferred++;
          } catch (err) {
            errors.push(`answered ${call.ID}: ${(err as Error).message}`);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      total: calls.length,
      missed: missed.length,
      created,
      updated,
      skipped,
      ...(summaries ? { answered: answeredStats } : {}),
      ...(analyticsShape ? { analyticsShape } : {}),
      errors: errors.length ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error("CRON paycall-sync error:", err);
    return NextResponse.json({ error: "Internal sync error" }, { status: 500 });
  }
}
