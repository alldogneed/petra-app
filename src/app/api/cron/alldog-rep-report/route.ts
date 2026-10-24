export const dynamic = "force-dynamic";
// ?coach= downloads + transcribes one recording and runs the assessment.
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCronAuth, verifyCronAuthWithVault } from "@/lib/cron-auth";
import { allDogBusinessId } from "@/lib/alldog/config";
import { getAnalyticsCallRecord, getCalls } from "@/lib/paycall";
import { buildRepReport, repFromPaycall, formatRepReport, periodLabel, readStoredCoaching, reportDays } from "@/lib/alldog/call-coaching";

/**
 * GET /api/cron/alldog-rep-report[?days=7]
 *
 * AllDog item 33 — weekly coaching report per rep from the answered PayCall calls
 * (PaycallCallRetry.coaching, written by src/lib/alldog/call-retry.ts). Returns JSON + the Hebrew
 * text. No customer names / phone numbers: only the rep, counts and short sales-skill quotes
 * (already scrubbed when stored). Auth: CRON_SECRET / CRON_SECRET_DB or the pg_cron Vault secret.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request) && !(await verifyCronAuthWithVault(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = allDogBusinessId();
  if (!businessId) return NextResponse.json({ ok: true, skipped: "disabled" });
  try {
    // ?probe=1 — confirms the rep detection on REAL PayCall data: the latest answered calls,
    // the KEY NAMES of their records (never values) and the rep each one resolves to.
    if (request.nextUrl.searchParams.get("probe") === "1") return NextResponse.json(await probeRepDetection());
    // ?coach=<PayCall call id> — coach one already-processed call (verification; no lead writes, nothing sent).
    const coachId = request.nextUrl.searchParams.get("coach");
    if (coachId) {
      if (!/^\d{1,20}$/.test(coachId)) return NextResponse.json({ error: "bad call id" }, { status: 400 });
      const { coachExistingCall } = await import("@/lib/alldog/call-summary");
      return NextResponse.json({ ok: true, callId: coachId, ...(await coachExistingCall(coachId)) });
    }
    const days = reportDays(request.nextUrl.searchParams.get("days"));
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.paycallCallRetry.findMany({
      where: { businessId, coachedAt: { gte: from, lte: to } },
      select: { coaching: true },
      orderBy: { coachedAt: "desc" },
      take: 2000,
    });
    const report = buildRepReport(
      rows.map((r) => readStoredCoaching(r.coaching)).filter((c): c is NonNullable<typeof c> => !!c),
      from,
      to
    );
    return NextResponse.json({ ok: true, days, report, text: formatRepReport(report, periodLabel(from, to)) });
  } catch (err) {
    console.error("CRON alldog-rep-report error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** Key names + resolved rep of the last few answered calls (no customer data: no caller, no values). */
async function probeRepDetection() {
  const now = new Date();
  const calls = await getCalls({ fromDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), toDate: now, limit: 200 });
  const answered = calls.filter((c) => c.DISPOSITION === "ANSWER").slice(0, 3);
  const keys = (o: object | null) => (o ? Object.keys(o).map((k) => k.replace(/\d{5,}/g, "#####").slice(0, 40)).slice(0, 50) : null);
  const samples = [];
  for (const c of answered) {
    const fromCalls = repFromPaycall(c);
    const analytics = fromCalls?.source === "destination_name" ? null : await getAnalyticsCallRecord(c.ID, new Date(c.START.replace(" ", "T") + "+03:00"));
    samples.push({
      callId: c.ID,
      getCallsKeys: keys(c),
      fromGetCalls: fromCalls,
      analyticsKeys: keys(analytics),
      fromAnalytics: analytics ? repFromPaycall(analytics) : null,
    });
  }
  return { ok: true, probe: true, answeredInWindow: calls.filter((c) => c.DISPOSITION === "ANSWER").length, samples };
}
