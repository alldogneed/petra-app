/**
 * Customers list — search, filters, sorting, paging, per-row enrichment, list stats.
 * Re-exported from ./clients for existing callers (API route, MCP list_clients).
 *
 * Every filter runs server-side over the WHOLE business (never over loaded pages):
 *  - "simple" filters (search, tag, vip, species, source, created range, service type) are one
 *    SQL WHERE fragment over "Customer" c;
 *  - "derived" filters (status active/dormant, last visit, balance/min debt) and the derived sorts
 *    (name / balance / last visit) resolve the full matching id list (≤ MATCH_CAP), compute the
 *    facts in a few grouped queries, filter + sort in JS and page with an offset cursor.
 *  - newest/oldest without derived filters page with a keyset cursor (customer id) in SQL.
 * Status / tag / phone rules live in src/lib/customer-filters.ts (pure, unit-tested).
 */
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { computeCustomerBalances, type CustomerBalance } from "@/lib/customer-balance";
import { israelDayStart, israelDayEnd, israelYmdOf } from "@/lib/report-dates";
import {
  EMPTY_CUSTOMER_FILTERS,
  FINANCE_SORTS,
  displayStatus,
  escapeLike,
  isCustomerActive,
  matchesBalance,
  matchesLastVisit,
  normalizePhoneSearch,
  parseOffsetCursor,
  parseTagList,
  hasVipTag,
  sortCustomerRows,
  tagLikePattern,
  SEARCH_MAX_LEN,
  TAG_MAX_LEN,
  type CustomerFilters,
  type CustomerSort,
} from "@/lib/customer-filters";

type DbClient = PrismaClient;

/** Safety cap on the matching-id scan for derived filters / sorts. */
const MATCH_CAP = 20_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface EnrichedCustomer {
  id: string; name: string; phone: string; email: string | null;
  address: string | null; idNumber: string | null; tags: string;
  notes: string | null; source: string | null; createdAt: Date;
  pets: Array<{ id: string; name: string; species: string; breed: string | null }>;
  _count: { pets: number; appointments: number };
  /** Display status — VIP wins over active/dormant (kept for MCP + badges). */
  status: "vip" | "active" | "dormant";
  /** Activity status regardless of VIP. */
  isActive: boolean;
  isVip: boolean; isInBoarding: boolean; hasActiveTraining: boolean;
  appointmentsLast30: number;
  lastAppointment: { date: Date; startTime: string; serviceName: string | null } | null;
  nextAppointment: { date: Date; startTime: string; serviceName: string | null } | null;
  /** totalPending = outstanding balance (src/lib/customer-balance.ts). Zeros without FINANCE_READ. */
  financial: { totalPaid: number; totalPending: number; hasDeposits: boolean };
  serviceTypes: string[];
}

export interface CustomerListStats {
  /** Customers matching the search (all other filters ignored — pill counts). */
  total: number;
  active: number;
  dormant: number;
  vip: number;
  /** 0 without finance access. */
  withDebt: number;
  /** null without finance access. */
  totalDebt: number | null;
  /** All customers of the business (free-tier limit / header), regardless of search. */
  businessTotal: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Options / result
// ─────────────────────────────────────────────────────────────────────────────

export interface CustomerListOptions extends Partial<Omit<CustomerFilters, "sortBy">> {
  enhanced?: boolean;
  cursor?: string;
  take?: number;
  sortBy?: CustomerSort;
  full?: boolean;
  /** Caller may see money (FINANCE_READ). Default true (MCP / legacy callers). */
  includeFinance?: boolean;
  /** Compute `stats` (first page only). */
  withStats?: boolean;
}

export type CustomerListResult =
  | {
      enhanced: true; customers: EnrichedCustomer[]; nextCursor: string | null; hasMore: boolean;
      total: number | null; stats?: CustomerListStats | null;
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { enhanced: false; customers: any[]; nextCursor?: string | null; hasMore?: boolean; total?: number | null };

/** Normalise options into a full, finance-aware filter set. */
export function resolveFilters(opts: CustomerListOptions): CustomerFilters {
  const finance = opts.includeFinance ?? true;
  const f: CustomerFilters = {
    ...EMPTY_CUSTOMER_FILTERS,
    search: opts.search?.trim().slice(0, SEARCH_MAX_LEN) || null,
    status: opts.status ?? null,
    balance: opts.balance ?? null,
    tag: opts.tag?.slice(0, TAG_MAX_LEN) || null,
    lastVisit: opts.lastVisit ?? null,
    species: opts.species ?? null,
    source: opts.source ?? null,
    createdFrom: opts.createdFrom ?? null,
    createdTo: opts.createdTo ?? null,
    minDebt: opts.minDebt ?? null,
    serviceType: opts.serviceType ?? null,
    sortBy: opts.sortBy ?? "newest",
  };
  if (!finance) {
    // Money filters/sorts would leak debts to callers without FINANCE_READ.
    f.balance = null;
    f.minDebt = null;
    if (FINANCE_SORTS.includes(f.sortBy)) f.sortBy = "newest";
  }
  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL fragments
// ─────────────────────────────────────────────────────────────────────────────

/** UTC midnight of today's Israel date — same encoding as Appointment.date. */
function israelTodayStart(now: Date): Date {
  return new Date(`${israelYmdOf(now)}T00:00:00.000Z`);
}

function searchSql(search: string): Prisma.Sql {
  const pat = `%${escapeLike(search)}%`;
  const digits = normalizePhoneSearch(search);
  const phoneFrag = digits
    ? Prisma.sql` OR regexp_replace(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'), '^972', '0') LIKE ${`%${digits}%`}`
    : Prisma.empty;
  return Prisma.sql`(c.name ILIKE ${pat} OR c.email ILIKE ${pat} OR c.phone ILIKE ${pat}
    OR EXISTS (SELECT 1 FROM "Pet" p WHERE p."customerId" = c.id AND p.name ILIKE ${pat})${phoneFrag})`;
}

/**
 * WHERE fragment over "Customer" c. `searchOnly` = business + search (stats basis).
 * Derived filters (status active/dormant, last visit, balance) are applied in JS.
 */
function whereSql(businessId: string, f: CustomerFilters, searchOnly = false): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`c."businessId" = ${businessId}`];
  if (f.search) parts.push(searchSql(f.search));
  if (!searchOnly) {
    if (f.tag) parts.push(Prisma.sql`c.tags LIKE ${tagLikePattern(f.tag)}`);
    if (f.status === "vip") parts.push(Prisma.sql`c.tags ILIKE ${'%"vip"%'}`);
    if (f.species === "dog" || f.species === "cat") {
      parts.push(Prisma.sql`EXISTS (SELECT 1 FROM "Pet" p WHERE p."customerId" = c.id AND p.species = ${f.species})`);
    } else if (f.species === "other") {
      parts.push(Prisma.sql`EXISTS (SELECT 1 FROM "Pet" p WHERE p."customerId" = c.id AND p.species NOT IN ('dog', 'cat'))`);
    }
    if (f.source) parts.push(Prisma.sql`c.source = ${f.source}`);
    if (f.createdFrom) parts.push(Prisma.sql`c."createdAt" >= ${israelDayStart(f.createdFrom)}`);
    if (f.createdTo) parts.push(Prisma.sql`c."createdAt" <= ${israelDayEnd(f.createdTo)}`);
    if (f.serviceType) {
      parts.push(Prisma.sql`EXISTS (SELECT 1 FROM "Appointment" a JOIN "Service" s ON s.id = a."serviceId"
        WHERE a."customerId" = c.id AND a."businessId" = ${businessId} AND s.type = ${f.serviceType})`);
    }
  }
  return Prisma.join(parts, " AND ");
}

/** Past non-canceled appointment ("visit"): before today, or already completed today. */
function visitSql(todayStart: Date): Prisma.Sql {
  return Prisma.sql`(a.status <> 'canceled' AND (a.date < ${todayStart} OR a.status = 'completed'))`;
}

function upcomingSql(todayStart: Date): Prisma.Sql {
  return Prisma.sql`(a.status = 'scheduled' AND a.date >= ${todayStart})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Facts
// ─────────────────────────────────────────────────────────────────────────────

interface ActivityFacts {
  visits: Map<string, { lastVisit: Date | null; hasUpcoming: boolean }>;
  boarding: Set<string>;
  training: Set<string>;
}

async function loadActivityFacts(
  db: DbClient,
  businessId: string,
  frag: Prisma.Sql,
  todayStart: Date
): Promise<ActivityFacts> {
  const [visitRows, boardingRows, trainingRows] = await Promise.all([
    db.$queryRaw<{ id: string; lastVisit: Date | null; hasUpcoming: boolean | null }[]>`
      SELECT a."customerId" AS id,
        max(a.date) FILTER (WHERE ${visitSql(todayStart)}) AS "lastVisit",
        bool_or(${upcomingSql(todayStart)}) AS "hasUpcoming"
      FROM "Appointment" a
      JOIN "Customer" c ON c.id = a."customerId"
      WHERE a."businessId" = ${businessId} AND ${frag}
      GROUP BY a."customerId"
    `,
    db.boardingStay.findMany({
      where: { businessId, status: { in: ["reserved", "checked_in"] }, customerId: { not: null } },
      select: { customerId: true },
      distinct: ["customerId"],
      take: MATCH_CAP,
    }),
    db.trainingProgram.findMany({
      where: { businessId, status: "ACTIVE", customerId: { not: null } },
      select: { customerId: true },
      distinct: ["customerId"],
      take: MATCH_CAP,
    }),
  ]);
  return {
    visits: new Map(visitRows.map((r) => [r.id, { lastVisit: r.lastVisit, hasUpcoming: !!r.hasUpcoming }])),
    boarding: new Set(boardingRows.map((r) => r.customerId as string)),
    training: new Set(trainingRows.map((r) => r.customerId as string)),
  };
}

function activeOf(
  row: { id: string; createdAt: Date },
  facts: ActivityFacts,
  todayStart: Date,
  now: Date
): boolean {
  const v = facts.visits.get(row.id);
  return isCustomerActive(
    {
      createdAt: row.createdAt,
      lastVisit: v?.lastVisit ?? null,
      hasUpcoming: v?.hasUpcoming ?? false,
      inBoarding: facts.boarding.has(row.id),
      activeTraining: facts.training.has(row.id),
    },
    todayStart,
    now
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Id resolution (shared by list + export)
// ─────────────────────────────────────────────────────────────────────────────

interface IdPage {
  ids: string[];
  total: number | null;
  nextCursor: string | null;
  hasMore: boolean;
}

interface ResolveCtx {
  now: Date;
  todayStart: Date;
  /** Facts / balances already loaded for a superset (stats) — reused when present. */
  facts?: ActivityFacts;
  balances?: Map<string, CustomerBalance>;
}

function needsFacts(f: CustomerFilters): boolean {
  return f.status === "active" || f.status === "dormant" || f.lastVisit !== null ||
    f.sortBy === "last_visit_desc" || f.sortBy === "last_visit_asc";
}

function needsBalances(f: CustomerFilters): boolean {
  return f.balance !== null || f.minDebt !== null || f.sortBy === "balance_desc";
}

function isDerived(f: CustomerFilters): boolean {
  return needsFacts(f) || needsBalances(f) || !(f.sortBy === "newest" || f.sortBy === "oldest");
}

async function resolveIdPage(
  db: DbClient,
  businessId: string,
  f: CustomerFilters,
  cursor: string | undefined,
  take: number,
  ctx: ResolveCtx
): Promise<IdPage> {
  const frag = whereSql(businessId, f);
  const offset = parseOffsetCursor(cursor);

  // ── Fast path: newest / oldest, SQL-only filters → keyset (or legacy offset) paging ──
  if (!isDerived(f)) {
    const desc = f.sortBy !== "oldest";
    const keyset =
      cursor && offset === null
        ? desc
          ? Prisma.sql` AND (c."createdAt", c.id) < (SELECT k."createdAt", k.id FROM "Customer" k WHERE k.id = ${cursor} AND k."businessId" = ${businessId})`
          : Prisma.sql` AND (c."createdAt", c.id) > (SELECT k."createdAt", k.id FROM "Customer" k WHERE k.id = ${cursor} AND k."businessId" = ${businessId})`
        : Prisma.empty;
    const order = desc ? Prisma.sql`c."createdAt" DESC, c.id DESC` : Prisma.sql`c."createdAt" ASC, c.id ASC`;
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT c.id FROM "Customer" c
      WHERE ${frag}${keyset}
      ORDER BY ${order}
      LIMIT ${take + 1} OFFSET ${offset ?? 0}
    `;
    const hasMore = rows.length > take;
    const ids = rows.slice(0, take).map((r) => r.id);
    let total: number | null = null;
    if (!cursor) {
      const [{ n }] = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "Customer" c WHERE ${frag}`;
      total = n;
    }
    const nextCursor = hasMore
      ? offset !== null ? String(offset + take) : (ids[ids.length - 1] ?? null)
      : null;
    return { ids, total, nextCursor, hasMore };
  }

  // ── General path: full matching set → JS filter + sort → offset page ──
  const matched = await db.$queryRaw<{ id: string; name: string; createdAt: Date }[]>`
    SELECT c.id, c.name, c."createdAt" FROM "Customer" c WHERE ${frag} LIMIT ${MATCH_CAP}
  `;

  const facts = needsFacts(f)
    ? ctx.facts ?? (await loadActivityFacts(db, businessId, frag, ctx.todayStart))
    : null;
  const balances = needsBalances(f)
    ? ctx.balances ?? (await computeCustomerBalances(db, businessId, null))
    : null;

  let rows = matched.map((r) => ({
    ...r,
    lastVisit: facts?.visits.get(r.id)?.lastVisit ?? null,
    outstanding: balances?.get(r.id)?.outstanding ?? 0,
  }));

  if (facts && (f.status === "active" || f.status === "dormant")) {
    const wantActive = f.status === "active";
    rows = rows.filter((r) => activeOf(r, facts, ctx.todayStart, ctx.now) === wantActive);
  }
  if (f.lastVisit) {
    const lv = f.lastVisit;
    rows = rows.filter((r) => matchesLastVisit(lv, r.lastVisit, ctx.todayStart));
  }
  if (balances) {
    rows = rows.filter((r) => matchesBalance(f.balance, f.minDebt, r.outstanding));
  }

  const sorted = sortCustomerRows(rows, f.sortBy);
  const start = offset ?? 0;
  const ids = sorted.slice(start, start + take).map((r) => r.id);
  const hasMore = start + take < sorted.length;
  return { ids, total: sorted.length, nextCursor: hasMore ? String(start + take) : null, hasMore };
}

/**
 * Ordered ids of every customer matching the filters (export). Capped at `cap`.
 */
export async function listCustomerIds(
  businessId: string,
  db: DbClient,
  opts: CustomerListOptions,
  cap = 10_000
): Promise<string[]> {
  const f = resolveFilters(opts);
  const now = new Date();
  const page = await resolveIdPage(db, businessId, f, undefined, Math.min(cap, MATCH_CAP), {
    now,
    todayStart: israelTodayStart(now),
  });
  return page.ids;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────────────────────

async function computeStats(
  db: DbClient,
  businessId: string,
  f: CustomerFilters,
  finance: boolean,
  ctx: ResolveCtx
): Promise<CustomerListStats> {
  const frag = whereSql(businessId, f, true);
  const [rows, facts, balances, businessTotal] = await Promise.all([
    db.$queryRaw<{ id: string; createdAt: Date; tags: string }[]>`
      SELECT c.id, c."createdAt", c.tags FROM "Customer" c WHERE ${frag} LIMIT ${MATCH_CAP}
    `,
    loadActivityFacts(db, businessId, frag, ctx.todayStart),
    finance ? computeCustomerBalances(db, businessId, null) : Promise.resolve(null),
    db.customer.count({ where: { businessId } }),
  ]);
  ctx.facts = facts;
  if (balances) ctx.balances = balances;

  let active = 0, vip = 0, withDebt = 0, totalDebt = 0;
  for (const r of rows) {
    if (activeOf(r, facts, ctx.todayStart, ctx.now)) active++;
    if (hasVipTag(r.tags)) vip++;
    const owed = balances?.get(r.id)?.outstanding ?? 0;
    if (owed > 0) { withDebt++; totalDebt += owed; }
  }
  return {
    total: rows.length,
    active,
    dormant: rows.length - active,
    vip,
    withDebt: finance ? withDebt : 0,
    totalDebt: finance ? Math.round(totalDebt * 100) / 100 : null,
    businessTotal,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page enrichment (bounded queries for ≤ 100 ids)
// ─────────────────────────────────────────────────────────────────────────────

async function enrichPage(
  db: DbClient,
  businessId: string,
  ids: string[],
  finance: boolean,
  ctx: ResolveCtx
): Promise<EnrichedCustomer[]> {
  if (ids.length === 0) return [];
  const { todayStart, now } = ctx;
  const idList = Prisma.join(ids);
  const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * DAY_MS);

  const [customers, lastRows, nextRows, recentRows, typeRows, boarding, training, balances, deposits] =
    await Promise.all([
      db.customer.findMany({
        where: { id: { in: ids }, businessId },
        select: {
          id: true, name: true, phone: true, email: true, address: true, idNumber: true,
          tags: true, notes: true, source: true, createdAt: true,
          pets: { select: { id: true, name: true, species: true, breed: true } },
          _count: { select: { pets: true, appointments: true } },
        },
      }),
      db.$queryRaw<{ customerId: string; date: Date; startTime: string; serviceName: string | null }[]>`
        SELECT DISTINCT ON (a."customerId") a."customerId", a.date, a."startTime", s.name AS "serviceName"
        FROM "Appointment" a LEFT JOIN "Service" s ON s.id = a."serviceId"
        WHERE a."businessId" = ${businessId} AND a."customerId" IN (${idList}) AND ${visitSql(todayStart)}
        ORDER BY a."customerId", a.date DESC, a."startTime" DESC
      `,
      db.$queryRaw<{ customerId: string; date: Date; startTime: string; serviceName: string | null }[]>`
        SELECT DISTINCT ON (a."customerId") a."customerId", a.date, a."startTime", s.name AS "serviceName"
        FROM "Appointment" a LEFT JOIN "Service" s ON s.id = a."serviceId"
        WHERE a."businessId" = ${businessId} AND a."customerId" IN (${idList}) AND ${upcomingSql(todayStart)}
        ORDER BY a."customerId", a.date ASC, a."startTime" ASC
      `,
      db.$queryRaw<{ customerId: string; n: number }[]>`
        SELECT a."customerId", count(*)::int AS n FROM "Appointment" a
        WHERE a."businessId" = ${businessId} AND a."customerId" IN (${idList})
          AND ${visitSql(todayStart)} AND a.date >= ${thirtyDaysAgo}
        GROUP BY a."customerId"
      `,
      db.$queryRaw<{ customerId: string; type: string }[]>`
        SELECT DISTINCT a."customerId", s.type FROM "Appointment" a JOIN "Service" s ON s.id = a."serviceId"
        WHERE a."businessId" = ${businessId} AND a."customerId" IN (${idList}) AND s.type IS NOT NULL
      `,
      db.boardingStay.findMany({
        where: { businessId, customerId: { in: ids }, status: { in: ["reserved", "checked_in"] } },
        select: { customerId: true },
        distinct: ["customerId"],
      }),
      db.trainingProgram.findMany({
        where: { businessId, customerId: { in: ids }, status: "ACTIVE" },
        select: { customerId: true },
        distinct: ["customerId"],
      }),
      finance ? computeCustomerBalances(db, businessId, ids) : Promise.resolve(new Map<string, CustomerBalance>()),
      finance
        ? db.payment.findMany({
            where: { businessId, customerId: { in: ids }, isDeposit: true },
            select: { customerId: true },
            distinct: ["customerId"],
          })
        : Promise.resolve([] as { customerId: string }[]),
    ]);

  const lastMap = new Map(lastRows.map((r) => [r.customerId, r]));
  const nextMap = new Map(nextRows.map((r) => [r.customerId, r]));
  const recentMap = new Map(recentRows.map((r) => [r.customerId, r.n]));
  const typeMap = new Map<string, string[]>();
  for (const r of typeRows) {
    const list = typeMap.get(r.customerId) ?? [];
    list.push(r.type);
    typeMap.set(r.customerId, list);
  }
  const boardingSet = new Set(boarding.map((b) => b.customerId as string));
  const trainingSet = new Set(training.map((t) => t.customerId as string));
  const depositSet = new Set(deposits.map((d) => d.customerId));
  const byId = new Map(customers.map((c) => [c.id, c]));

  const out: EnrichedCustomer[] = [];
  for (const id of ids) {
    const c = byId.get(id);
    if (!c) continue;
    const last = lastMap.get(id) ?? null;
    const next = nextMap.get(id) ?? null;
    const isVip = hasVipTag(parseTagList(c.tags));
    const isInBoarding = boardingSet.has(id);
    const hasActiveTraining = trainingSet.has(id);
    const isActive = isCustomerActive(
      { createdAt: c.createdAt, lastVisit: last?.date ?? null, hasUpcoming: !!next, inBoarding: isInBoarding, activeTraining: hasActiveTraining },
      todayStart,
      now
    );
    const bal = balances.get(id);
    out.push({
      ...c,
      status: displayStatus(isVip, isActive),
      isActive,
      isVip,
      isInBoarding,
      hasActiveTraining,
      appointmentsLast30: recentMap.get(id) ?? 0,
      lastAppointment: last ? { date: last.date, startTime: last.startTime, serviceName: last.serviceName } : null,
      nextAppointment: next ? { date: next.date, startTime: next.startTime, serviceName: next.serviceName } : null,
      financial: {
        totalPaid: finance ? bal?.totalPaid ?? 0 : 0,
        totalPending: finance ? bal?.outstanding ?? 0 : 0,
        hasDeposits: finance ? depositSet.has(id) : false,
      },
      serviceTypes: typeMap.get(id) ?? [],
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Customers — list
// ─────────────────────────────────────────────────────────────────────────────

export async function listCustomers(
  businessId: string,
  db: DbClient,
  opts: CustomerListOptions = {}
): Promise<CustomerListResult> {
  const enhanced = opts.enhanced ?? false;
  const finance = opts.includeFinance ?? true;
  const take = Math.min(Math.max(Number.isFinite(opts.take) ? (opts.take as number) : 50, 1), 100);
  const cursor = opts.cursor || undefined;
  const f = resolveFilters(opts);
  const now = new Date();
  const ctx: ResolveCtx = { now, todayStart: israelTodayStart(now) };

  // Stats first so the id resolution can reuse its facts / balances (superset).
  const stats = enhanced && opts.withStats && !cursor ? await computeStats(db, businessId, f, finance, ctx) : null;
  const page = await resolveIdPage(db, businessId, f, cursor, take, ctx);

  if (enhanced) {
    const customers = await enrichPage(db, businessId, page.ids, finance, ctx);
    return {
      enhanced: true,
      customers,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      total: page.total,
      ...(stats ? { stats } : {}),
    };
  }

  // ── Basic mode (pickers across the app): plain array, same shape as before ──
  const fetched = await db.customer.findMany({
    where: { id: { in: page.ids }, businessId },
    include: opts.full
      ? { pets: { select: { id: true, name: true, species: true } } }
      : { _count: { select: { pets: true, appointments: true } } },
  });
  const cmap = new Map(fetched.map((c) => [c.id, c]));
  return { enhanced: false, customers: page.ids.map((id) => cmap.get(id)).filter(Boolean) };
}
