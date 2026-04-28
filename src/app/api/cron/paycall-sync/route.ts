export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { getCalls, isMissedCall, processMissedCall } from "@/lib/paycall";

/**
 * GET /api/cron/paycall-sync
 *
 * Backfill missed-call leads from PayCall. Pulls calls from the last 24 hours,
 * filters for missed dispositions, and processes each one. Idempotent — already
 * processed calls (matching call_id in CallLog summary) are skipped.
 *
 * Acts as a safety net behind the realtime webhook. Authentication via cron
 * secret (Authorization: Bearer or x-cron-secret header).
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
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

    return NextResponse.json({
      ok: true,
      total: calls.length,
      missed: missed.length,
      created,
      updated,
      skipped,
      errors: errors.length ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error("CRON paycall-sync error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
