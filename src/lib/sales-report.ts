/**
 * Sales (leads) report — pure aggregation, no Prisma.
 * Contract: `SalesReport` in src/lib/analytics-types.ts (every field documented there).
 *
 * Shared definitions:
 *  - Won lead  = current stage `isWon`;  Lost lead = current stage `isLost`; anything else is open.
 *  - A won/lost EVENT (activity basis, monthly, historical rate) needs both the timestamp (wonAt/lostAt)
 *    AND a current stage that agrees — a lead that was won and later reopened is not counted (same as /analytics).
 *  - Conversion = won / (won + lost); open leads are never in the denominator.
 *  - Contact log = CallLog whose type is not "stage_change" / "deal_value".
 *  - `dealValue` is a manual amount, NOT revenue (CLAUDE.md rule #28).
 */
import type {
  AgingBucket,
  LeadReportBasis,
  LeadSourceRow,
  ResponseBucket,
  SalesReport,
} from "@/lib/analytics-types";
import { LOST_REASON_CODES } from "@/lib/constants";
import { monthKeysBetween, israelMonthKey, pct } from "@/lib/report-dates";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SalesReportCallLog {
  type: string;
  summary: string;
  createdAt: Date;
}

export interface SalesReportLead {
  id: string;
  name: string;
  source: string;
  trafficSource: string | null;
  landingPage: string | null;
  stage: string;
  createdAt: Date;
  wonAt: Date | null;
  lostAt: Date | null;
  wonByUserId: string | null;
  lostByUserId: string | null;
  lostReasonCode: string | null;
  lostReasonText: string | null;
  dealValue: number | null;
  /** Last active stage before archiving (won/lost) — optional extra evidence for the funnel. */
  previousStageId?: string | null;
  callLogs: SalesReportCallLog[];
}

export interface SalesReportStage {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isWon: boolean;
  isLost: boolean;
}

export interface SalesReportInput {
  leads: SalesReportLead[];
  stages: SalesReportStage[];
  /** PlatformUser id → display name (closers). */
  userNames: Record<string, string>;
  from: Date;
  to: Date;
  basis: LeadReportBasis;
  canSeeMoney: boolean;
  now: Date;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const NON_CONTACT_LOG_TYPES = new Set(["stage_change", "deal_value"]);

export const RESPONSE_BUCKETS: ResponseBucket[] = ["lt1h", "1to4h", "4to24h", "1to3d", "gt3d", "none"];
export const AGING_BUCKETS: AgingBucket[] = ["0-7", "8-14", "15-30", "31-60", "60+"];

export const UNKNOWN_USER_ID = "unknown";
export const UNKNOWN_USER_NAME = "לא תועד";
const REMOVED_USER_NAME = "משתמש שהוסר";
/** Lost leads without a reason code. Separate from the real "OTHER" ("אחר") code so the two never collide. */
export const NO_LOST_REASON_CODE = "NONE";
export const NO_LOST_REASON_LABEL = "ללא סיבה";
const BY_LANDING_PAGE_LIMIT = 15;

// ─── Small helpers ────────────────────────────────────────────────────────────

function hasValue(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function money(v: number): number {
  return Math.round(v * 100) / 100;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function inRange(d: Date | null | undefined, from: Date, to: Date): boolean {
  if (!d) return false;
  const t = d.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function isContactLog(log: { type: string }): boolean {
  return !NON_CONTACT_LOG_TYPES.has(log.type);
}

/** Parses `הועבר מ"<from>" ל"<to>"` → [from, to] (trimmed). null when the summary has another shape. */
export function parseStageChangeSummary(summary: string): [string, string] | null {
  const m = /^\s*הועבר מ"([\s\S]*?)" ל"([\s\S]*)"\s*$/.exec(summary);
  if (!m) return null;
  return [m[1].trim(), m[2].trim()];
}

/** Hours from lead creation to its first contact log (logs before createdAt are ignored). null = never contacted. */
export function firstResponseHours(lead: Pick<SalesReportLead, "createdAt" | "callLogs">): number | null {
  const created = lead.createdAt.getTime();
  let first: number | null = null;
  for (const log of lead.callLogs) {
    if (!isContactLog(log)) continue;
    const t = log.createdAt.getTime();
    if (t < created) continue;
    if (first === null || t < first) first = t;
  }
  return first === null ? null : (first - created) / HOUR_MS;
}

export function responseBucketOf(hours: number | null): ResponseBucket {
  if (hours === null) return "none";
  if (hours < 1) return "lt1h";
  if (hours < 4) return "1to4h";
  if (hours < 24) return "4to24h";
  if (hours < 72) return "1to3d";
  return "gt3d";
}

export function agingBucketOf(days: number): AgingBucket {
  if (days <= 7) return "0-7";
  if (days <= 14) return "8-14";
  if (days <= 30) return "15-30";
  if (days <= 60) return "31-60";
  return "60+";
}

// ─── Row aggregation (bySource / byTrafficSource / byLandingPage) ─────────────

interface RowItem {
  key: string;
  /** Counted in `total`. */
  inTotal: boolean;
  /** Counted in `open` (must imply inTotal). */
  isOpen: boolean;
  isWon: boolean;
  isLost: boolean;
  dealValue: number | null;
}

function aggregateRows(items: RowItem[], canSeeMoney: boolean): LeadSourceRow[] {
  const map = new Map<string, { total: number; won: number; lost: number; open: number; wonValue: number }>();
  for (const it of items) {
    const r = map.get(it.key) ?? { total: 0, won: 0, lost: 0, open: 0, wonValue: 0 };
    if (it.inTotal) r.total++;
    if (it.isOpen) r.open++;
    if (it.isWon) {
      r.won++;
      if (hasValue(it.dealValue)) r.wonValue += it.dealValue;
    } else if (it.isLost) {
      r.lost++;
    }
    map.set(it.key, r);
  }
  return Array.from(map.entries())
    .map(([source, r]) => ({
      source,
      total: r.total,
      won: r.won,
      lost: r.lost,
      open: r.open,
      conversionRate: pct(r.won, r.won + r.lost),
      wonValue: canSeeMoney ? money(r.wonValue) : null,
    }))
    .sort((a, b) => b.total - a.total || b.won - a.won || a.source.localeCompare(b.source));
}

/**
 * Group leads by `key` → total / won / lost / open / conversion / wonValue, sorted by total desc.
 * open = total − won − lost. wonValue = Σ dealValue of won rows that have a value (null when money hidden).
 */
export function buildLeadSourceRows(
  leads: { key: string; isWon: boolean; isLost: boolean; dealValue: number | null }[],
  canSeeMoney: boolean
): LeadSourceRow[] {
  return aggregateRows(
    leads.map((l) => ({
      key: l.key,
      inTotal: true,
      isOpen: !l.isWon && !l.isLost,
      isWon: l.isWon,
      isLost: !l.isWon && l.isLost,
      dealValue: l.dealValue,
    })),
    canSeeMoney
  );
}

// ─── Set selection (cohort vs activity) ───────────────────────────────────────

interface Classified {
  lead: SalesReportLead;
  /** Current stage says won / lost. */
  currentWon: boolean;
  currentLost: boolean;
  currentOpen: boolean;
}

interface Flagged {
  c: Classified;
  /** Counted in kpis.total (created in range). */
  created: boolean;
  /** Counted as won / lost for this basis. */
  won: boolean;
  lost: boolean;
  /** Created in range and still open. */
  open: boolean;
}

/**
 * The leads a range "touches" for a basis.
 *  - cohort:   leads created in range; won/lost = their current outcome.
 *  - activity: leads created in range ∪ won in range (wonAt) ∪ lost in range (lostAt).
 *    total/open count only the created ones; won/lost only the in-range events.
 */
function selectSet(all: Classified[], basis: LeadReportBasis, from: Date, to: Date): Flagged[] {
  const out: Flagged[] = [];
  for (const c of all) {
    const created = inRange(c.lead.createdAt, from, to);
    if (basis === "cohort") {
      if (!created) continue;
      out.push({ c, created: true, won: c.currentWon, lost: c.currentLost, open: c.currentOpen });
    } else {
      const won = c.currentWon && inRange(c.lead.wonAt, from, to);
      const lost = c.currentLost && inRange(c.lead.lostAt, from, to);
      if (!created && !won && !lost) continue;
      out.push({ c, created, won, lost, open: created && c.currentOpen });
    }
  }
  return out;
}

function summarize(set: Flagged[], canSeeMoney: boolean) {
  let total = 0;
  let won = 0;
  let lost = 0;
  let open = 0;
  let wonValue = 0;
  let wonWithValueCount = 0;
  for (const f of set) {
    if (f.created) total++;
    if (f.open) open++;
    if (f.won) {
      won++;
      if (hasValue(f.c.lead.dealValue)) {
        wonValue += f.c.lead.dealValue;
        wonWithValueCount++;
      }
    }
    if (f.lost) lost++;
  }
  return {
    total,
    won,
    lost,
    open,
    conversionRate: pct(won, won + lost),
    lostRate: pct(lost, won + lost),
    wonValue: canSeeMoney ? money(wonValue) : null,
    wonWithValueCount,
    avgDealValue: canSeeMoney && wonWithValueCount > 0 ? Math.round(wonValue / wonWithValueCount) : null,
  };
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildSalesReport(input: SalesReportInput): SalesReport {
  const { leads, stages, userNames, from, to, basis, canSeeMoney, now } = input;

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const activeStages = stages.filter((s) => !s.isWon && !s.isLost).sort((a, b) => a.sortOrder - b.sortOrder);
  const wonStage = [...stages].filter((s) => s.isWon).sort((a, b) => a.sortOrder - b.sortOrder)[0];

  const classified: Classified[] = leads.map((lead) => {
    const st = stageById.get(lead.stage);
    const currentWon = !!st?.isWon;
    const currentLost = !currentWon && !!st?.isLost;
    return { lead, currentWon, currentLost, currentOpen: !currentWon && !currentLost };
  });

  // ── Current + previous range ──
  const set = selectSet(classified, basis, from, to);
  const cur = summarize(set, canSeeMoney);

  const spanMs = to.getTime() - from.getTime() + 1;
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(from.getTime() - spanMs);
  const prev = summarize(selectSet(classified, basis, prevFrom, prevTo), canSeeMoney);

  // ── Time to close ──
  const closeDays: number[] = [];
  for (const f of set) {
    if (f.won && f.c.lead.wonAt) {
      closeDays.push(Math.max(0, (f.c.lead.wonAt.getTime() - f.c.lead.createdAt.getTime()) / DAY_MS));
    }
  }
  const avgDaysToClose = closeDays.length ? round1(closeDays.reduce((a, b) => a + b, 0) / closeDays.length) : null;

  // ── First response (leads created in range, both bases) ──
  const responseCounts = new Map<ResponseBucket, number>(RESPONSE_BUCKETS.map((b) => [b, 0]));
  const responseHours: number[] = [];
  let unrespondedOpenCount = 0;
  for (const c of classified) {
    if (!inRange(c.lead.createdAt, from, to)) continue;
    const h = firstResponseHours(c.lead);
    responseCounts.set(responseBucketOf(h), (responseCounts.get(responseBucketOf(h)) ?? 0) + 1);
    if (h !== null) responseHours.push(h);
    if (c.currentOpen && !c.lead.callLogs.some(isContactLog)) unrespondedOpenCount++;
  }
  const avgFirstResponseHours = responseHours.length
    ? round1(responseHours.reduce((a, b) => a + b, 0) / responseHours.length)
    : null;
  const med = median(responseHours);
  const medianFirstResponseHours = med === null ? null : round1(med);

  // ── Pipeline / aging / stale (snapshot of ALL currently open leads) ──
  let pipelineValue = 0;
  let pipelineWithValueCount = 0;
  const agingMap = new Map<AgingBucket, { count: number; value: number }>(
    AGING_BUCKETS.map((b) => [b, { count: 0, value: 0 }])
  );
  const staleMap = new Map<string, { count: number; oldestDays: number }>();
  for (const c of classified) {
    if (!c.currentOpen) continue;
    const dv = c.lead.dealValue;
    if (hasValue(dv)) {
      pipelineValue += dv;
      pipelineWithValueCount++;
    }
    const ageDays = Math.max(0, Math.floor((now.getTime() - c.lead.createdAt.getTime()) / DAY_MS));
    const a = agingMap.get(agingBucketOf(ageDays))!;
    a.count++;
    if (hasValue(dv)) a.value += dv;
    const st = stageById.get(c.lead.stage);
    if (st) {
      const s = staleMap.get(st.id) ?? { count: 0, oldestDays: 0 };
      s.count++;
      s.oldestDays = Math.max(s.oldestDays, ageDays);
      staleMap.set(st.id, s);
    }
  }

  // ── Historical conversion (last 365 days by wonAt / lostAt) ──
  const yearAgo = new Date(now.getTime() - 365 * DAY_MS);
  let histWon = 0;
  let histLost = 0;
  for (const c of classified) {
    if (c.currentWon && inRange(c.lead.wonAt, yearAgo, now)) histWon++;
    if (c.currentLost && inRange(c.lead.lostAt, yearAgo, now)) histLost++;
  }
  const historicalConversionRate = pct(histWon, histWon + histLost);
  const forecastValue =
    canSeeMoney && historicalConversionRate !== null
      ? Math.round((pipelineValue * historicalConversionRate) / 100)
      : null;

  // ── Monthly (activity-style, each event by its own date) ──
  const monthKeys = monthKeysBetween(from, to);
  const monthMap = new Map(monthKeys.map((k) => [k, { created: 0, won: 0, lost: 0, wonValue: 0 }]));
  for (const c of classified) {
    const l = c.lead;
    if (inRange(l.createdAt, from, to)) {
      const m = monthMap.get(israelMonthKey(l.createdAt));
      if (m) m.created++;
    }
    if (c.currentWon && l.wonAt && inRange(l.wonAt, from, to)) {
      const m = monthMap.get(israelMonthKey(l.wonAt));
      if (m) {
        m.won++;
        if (hasValue(l.dealValue)) m.wonValue += l.dealValue;
      }
    }
    if (c.currentLost && l.lostAt && inRange(l.lostAt, from, to)) {
      const m = monthMap.get(israelMonthKey(l.lostAt));
      if (m) m.lost++;
    }
  }
  const monthly = monthKeys.map((month) => {
    const m = monthMap.get(month)!;
    return { month, created: m.created, won: m.won, lost: m.lost, wonValue: canSeeMoney ? money(m.wonValue) : null };
  });

  // ── Breakdowns over the set ──
  const rowItems = (keyOf: (l: SalesReportLead) => string | null): RowItem[] => {
    const out: RowItem[] = [];
    for (const f of set) {
      const key = keyOf(f.c.lead);
      if (key === null) continue;
      out.push({ key, inTotal: f.created, isOpen: f.open, isWon: f.won, isLost: f.lost, dealValue: f.c.lead.dealValue });
    }
    return out;
  };
  const bySource = aggregateRows(rowItems((l) => l.source || "manual"), canSeeMoney);
  const byTrafficSource = aggregateRows(rowItems((l) => l.trafficSource || "unknown"), canSeeMoney);
  const byLandingPage = aggregateRows(
    rowItems((l) => (l.landingPage && l.landingPage.trim() ? l.landingPage.trim() : null)),
    false
  )
    .slice(0, BY_LANDING_PAGE_LIMIT)
    .map((r) => ({ page: r.source, total: r.total, won: r.won, conversionRate: r.conversionRate }));

  // ── By closer ──
  const userMap = new Map<string, { won: number; lost: number; wonValue: number }>();
  for (const f of set) {
    if (!f.won && !f.lost) continue;
    const raw = f.won ? f.c.lead.wonByUserId : f.c.lead.lostByUserId;
    const userId = raw && raw.trim() ? raw : UNKNOWN_USER_ID;
    const u = userMap.get(userId) ?? { won: 0, lost: 0, wonValue: 0 };
    if (f.won) {
      u.won++;
      if (hasValue(f.c.lead.dealValue)) u.wonValue += f.c.lead.dealValue;
    } else {
      u.lost++;
    }
    userMap.set(userId, u);
  }
  const byUser = Array.from(userMap.entries())
    .map(([userId, u]) => ({
      userId,
      name: userId === UNKNOWN_USER_ID ? UNKNOWN_USER_NAME : userNames[userId] ?? REMOVED_USER_NAME,
      won: u.won,
      lost: u.lost,
      conversionRate: pct(u.won, u.won + u.lost),
      wonValue: canSeeMoney ? money(u.wonValue) : null,
    }))
    .sort((a, b) => b.won + b.lost - (a.won + a.lost) || b.won - a.won);

  // ── Funnel ──
  const funnelStages = [...activeStages, ...(wonStage ? [wonStage] : [])];
  const wonIndex = wonStage ? funnelStages.length - 1 : -1;
  const indexById = new Map(funnelStages.map((s, i) => [s.id, i]));
  const indexByName = new Map<string, number>();
  funnelStages.forEach((s, i) => {
    const key = s.name.trim();
    if (!indexByName.has(key)) indexByName.set(key, i);
  });
  const reachedCounts = funnelStages.map(() => 0);
  const currentCounts = funnelStages.map(() => 0);
  for (const f of set) {
    const l = f.c.lead;
    // Every lead entered the pipeline, so it is known to have been at least at the first stage.
    let maxIdx = funnelStages.length > 0 ? 0 : -1;
    const curIdx = indexById.get(l.stage);
    if (curIdx !== undefined) {
      maxIdx = Math.max(maxIdx, curIdx);
      currentCounts[curIdx]++;
    }
    if (f.c.currentWon) maxIdx = Math.max(maxIdx, wonIndex);
    if (l.previousStageId) {
      const p = indexById.get(l.previousStageId);
      if (p !== undefined) maxIdx = Math.max(maxIdx, p);
    }
    for (const log of l.callLogs) {
      if (log.type !== "stage_change") continue;
      const names = parseStageChangeSummary(log.summary);
      if (!names) continue;
      for (const n of names) {
        const i = indexByName.get(n);
        if (i !== undefined) maxIdx = Math.max(maxIdx, i);
      }
    }
    for (let i = 0; i <= maxIdx; i++) reachedCounts[i]++;
  }
  const funnel = funnelStages.map((s, i) => ({
    stageId: s.id,
    name: s.name,
    color: s.color,
    reached: reachedCounts[i],
    current: currentCounts[i],
    stepConversion: i === 0 ? null : pct(reachedCounts[i], reachedCounts[i - 1]),
  }));

  // ── Aging / stale output ──
  const aging = AGING_BUCKETS.map((bucket) => {
    const a = agingMap.get(bucket)!;
    return { bucket, count: a.count, value: canSeeMoney ? money(a.value) : null };
  });
  const stale = activeStages
    .filter((s) => (staleMap.get(s.id)?.count ?? 0) > 0)
    .map((s) => {
      const v = staleMap.get(s.id)!;
      return { stageId: s.id, name: s.name, color: s.color, count: v.count, oldestDays: v.oldestDays };
    });

  // ── Lost reasons ──
  const lostMap = new Map<string, number>();
  for (const f of set) {
    if (!f.lost) continue;
    const code = f.c.lead.lostReasonCode?.trim() || NO_LOST_REASON_CODE;
    lostMap.set(code, (lostMap.get(code) ?? 0) + 1);
  }
  const lostReasons = Array.from(lostMap.entries())
    .map(([code, count]) => ({
      code,
      label:
        code === NO_LOST_REASON_CODE
          ? NO_LOST_REASON_LABEL
          : LOST_REASON_CODES.find((r) => r.id === code)?.label ?? code,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

  return {
    basis,
    from: from.toISOString(),
    to: to.toISOString(),
    generatedAt: now.toISOString(),
    canSeeMoney,
    kpis: {
      total: cur.total,
      won: cur.won,
      lost: cur.lost,
      open: cur.open,
      conversionRate: cur.conversionRate,
      lostRate: cur.lostRate,
      avgDaysToClose,
      avgFirstResponseHours,
      medianFirstResponseHours,
      respondedCount: responseHours.length,
      unrespondedOpenCount,
      wonValue: cur.wonValue,
      wonWithValueCount: cur.wonWithValueCount,
      avgDealValue: cur.avgDealValue,
      pipelineValue: canSeeMoney ? money(pipelineValue) : null,
      pipelineWithValueCount,
      historicalConversionRate,
      forecastValue,
    },
    previous: {
      total: prev.total,
      won: prev.won,
      lost: prev.lost,
      conversionRate: prev.conversionRate,
      wonValue: prev.wonValue,
    },
    monthly,
    bySource,
    byTrafficSource,
    byLandingPage,
    byUser,
    responseTime: RESPONSE_BUCKETS.map((bucket) => ({ bucket, count: responseCounts.get(bucket) ?? 0 })),
    funnel,
    aging,
    stale,
    lostReasons,
  };
}
