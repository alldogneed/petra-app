export const dynamic = "force-dynamic";
// Each attempt = recording download + transcription + summary (tens of seconds).
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth, verifyCronAuthWithVault } from "@/lib/cron-auth";
import { isCallSummariesEnabled } from "@/lib/alldog/config";

/**
 * GET /api/cron/alldog-call-retry
 *
 * Runs the due attempts of the answered-call retry queue (src/lib/alldog/call-retry.ts):
 * +3 min, +10 min, +30 min, +2 h (final). Every 5 minutes from Supabase pg_cron
 * (prisma/cron_alldog_call_retry.sql) with the GitHub workflow as a fallback
 * (Vercel Hobby crons are daily only). Safe to overlap: each call row is claimed first.
 * Auth: CRON_SECRET / CRON_SECRET_DB or the pg_cron Vault secret.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request) && !(await verifyCronAuthWithVault(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isCallSummariesEnabled()) {
    return NextResponse.json({ ok: true, skipped: "disabled" });
  }
  try {
    const { processDueRetries } = await import("@/lib/alldog/call-retry");
    const summary = await processDueRetries({ budgetMs: 230_000, limit: 20 });
    return NextResponse.json({ ok: true, ...summary, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("CRON alldog-call-retry error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
