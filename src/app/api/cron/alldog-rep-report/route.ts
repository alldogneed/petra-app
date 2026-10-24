export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCronAuth, verifyCronAuthWithVault } from "@/lib/cron-auth";
import { allDogBusinessId } from "@/lib/alldog/config";
import { buildRepReport, formatRepReport, periodLabel, readStoredCoaching, reportDays } from "@/lib/alldog/call-coaching";

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
    const days = reportDays(request.nextUrl.searchParams.get("days"));
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.paycallCallRetry.findMany({
      where: { businessId, coachedAt: { gte: from, lte: to } },
      select: { coaching: true },
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
