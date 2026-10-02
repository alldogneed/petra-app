/**
 * Sales (leads) report service — GET /api/leads/reports.
 * Loads the minimal lead data for the requested range and hands it to the pure
 * `buildSalesReport()` (src/lib/sales-report.ts). No $transaction (PgBouncer).
 */
import type { LeadReportBasis, SalesReport } from "@/lib/analytics-types";
import { isYmd, israelDayStart, israelDayEnd, israelTodayYmd } from "@/lib/report-dates";
import { buildSalesReport, type SalesReportLead } from "@/lib/sales-report";
import { ServiceError, type PrismaClient } from "./types";

export type DbClient = PrismaClient;

export interface GetLeadsReportOptions {
  from?: string | null;
  to?: string | null;
  basis?: string | null;
  canSeeMoney: boolean;
  now?: Date;
}

/** Default range length (Israel days, inclusive, ending today). */
export const DEFAULT_RANGE_DAYS = 90;
/** Max span of a custom range. */
export const MAX_RANGE_DAYS = 5 * 366;
/** Safety cap on loaded lead rows. */
export const MAX_LEAD_ROWS = 20_000;

const DAY_MS = 86_400_000;

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function ymdDiffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00.000Z`) - Date.parse(`${a}T00:00:00.000Z`)) / DAY_MS);
}

export function resolveReportRange(
  opts: { from?: string | null; to?: string | null },
  now: Date
): { fromYmd: string; toYmd: string } {
  const rawFrom = opts.from?.trim() || null;
  const rawTo = opts.to?.trim() || null;
  if (rawFrom !== null && !isYmd(rawFrom)) throw new ServiceError("תאריך התחלה לא תקין", "VALIDATION");
  if (rawTo !== null && !isYmd(rawTo)) throw new ServiceError("תאריך סיום לא תקין", "VALIDATION");

  const toYmd = rawTo ?? israelTodayYmd(now);
  const fromYmd = rawFrom ?? addDaysYmd(toYmd, -(DEFAULT_RANGE_DAYS - 1));
  if (fromYmd > toYmd) throw new ServiceError("תאריך ההתחלה מאוחר מתאריך הסיום", "VALIDATION");
  if (ymdDiffDays(fromYmd, toYmd) + 1 > MAX_RANGE_DAYS) {
    throw new ServiceError("טווח התאריכים ארוך מדי (עד 5 שנים)", "VALIDATION");
  }
  return { fromYmd, toYmd };
}

export async function getLeadsReport(
  businessId: string,
  db: DbClient,
  opts: GetLeadsReportOptions
): Promise<SalesReport & { truncated?: boolean }> {
  const now = opts.now ?? new Date();
  const basis: LeadReportBasis = opts.basis === "activity" ? "activity" : "cohort";
  const { fromYmd, toYmd } = resolveReportRange(opts, now);
  const from = israelDayStart(fromYmd);
  const to = israelDayEnd(toYmd);

  // Previous equal-length range (same as buildSalesReport) + 365-day window for the historical rate.
  const spanMs = to.getTime() - from.getTime() + 1;
  const prevFrom = new Date(from.getTime() - spanMs);
  const yearAgo = new Date(now.getTime() - 365 * DAY_MS);
  const eventsFrom = prevFrom < yearAgo ? prevFrom : yearAgo;

  const stages = await db.leadStage.findMany({
    where: { businessId },
    select: { id: true, name: true, color: true, sortOrder: true, isWon: true, isLost: true },
    orderBy: { sortOrder: "asc" },
  });
  const closedStageIds = stages.filter((s) => s.isWon || s.isLost).map((s) => s.id);

  const rows = await db.lead.findMany({
    where: {
      businessId,
      OR: [
        // current + previous range (createdAt / wonAt / lostAt), and the 365-day historical window
        { createdAt: { gte: prevFrom, lte: to } },
        { wonAt: { gte: eventsFrom } },
        { lostAt: { gte: eventsFrom } },
        // every currently open lead (pipeline / aging / stale snapshot)
        { stage: { notIn: closedStageIds } },
      ],
    },
    select: {
      id: true,
      name: true,
      source: true,
      trafficSource: true,
      landingPage: true,
      stage: true,
      previousStageId: true,
      createdAt: true,
      wonAt: true,
      lostAt: true,
      wonByUserId: true,
      lostByUserId: true,
      lostReasonCode: true,
      lostReasonText: true,
      dealValue: true,
      callLogs: {
        where: { type: { not: "deal_value" } },
        select: { type: true, summary: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        // Only the first contact + the stage-change chain matter; cap per lead to bound memory.
        take: 200,
      },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_LEAD_ROWS + 1,
  });

  const truncated = rows.length > MAX_LEAD_ROWS;
  const leads: SalesReportLead[] = truncated ? rows.slice(0, MAX_LEAD_ROWS) : rows;

  // Closers: wonByUserId / lostByUserId hold PlatformUser ids (session.user.id). Resolve names only
  // through this business's memberships so a foreign id can never leak another tenant's user.
  const closerIds = Array.from(
    new Set(leads.flatMap((l) => [l.wonByUserId, l.lostByUserId]).filter((id): id is string => !!id))
  );
  const userNames: Record<string, string> = {};
  if (closerIds.length > 0) {
    const members = await db.businessUser.findMany({
      where: { businessId, userId: { in: closerIds } },
      select: { userId: true, user: { select: { name: true } } },
    });
    for (const m of members) userNames[m.userId] = m.user.name;
  }

  const report = buildSalesReport({
    leads,
    stages,
    userNames,
    from,
    to,
    basis,
    canSeeMoney: opts.canSeeMoney,
    now,
  });
  return truncated ? { ...report, truncated: true } : report;
}
