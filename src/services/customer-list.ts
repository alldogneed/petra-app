/**
 * Customers list — search, filters, sorting, paging, per-row enrichment.
 * Re-exported from ./clients for existing callers (API route, MCP list_clients).
 */
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

type DbClient = PrismaClient;

const ENHANCED_INCLUDE = {
  pets: { select: { id: true, name: true, species: true, breed: true } },
  appointments: {
    select: {
      date: true, startTime: true, status: true,
      service: { select: { name: true, type: true } },
    },
    orderBy: { date: "desc" as const },
    take: 20,
  },
  payments: {
    select: { amount: true, status: true, isDeposit: true },
    orderBy: { createdAt: "desc" as const },
    take: 50,
  },
  boardingStays: {
    where: { status: { in: ["reserved", "checked_in"] as string[] } },
    select: { id: true, status: true },
    take: 1,
  },
  trainingPrograms: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
  _count: { select: { pets: true, appointments: true } },
};

type RawEnhancedCustomer = {
  id: string; name: string; phone: string; email: string | null;
  address: string | null; idNumber: string | null; tags: string;
  notes: string | null; source: string; createdAt: Date;
  pets: Array<{ id: string; name: string; species: string; breed: string | null }>;
  _count: { pets: number; appointments: number };
  appointments: Array<{ date: Date; startTime: string; status: string; service: { name: string; type: string } | null }>;
  payments: Array<{ amount: number; status: string; isDeposit: boolean }>;
  boardingStays: Array<{ id: string; status: string }>;
  trainingPrograms: Array<{ id: string }>;
};

export interface EnrichedCustomer {
  id: string; name: string; phone: string; email: string | null;
  address: string | null; idNumber: string | null; tags: string;
  notes: string | null; source: string; createdAt: Date;
  pets: Array<{ id: string; name: string; species: string; breed: string | null }>;
  _count: { pets: number; appointments: number };
  status: "vip" | "active" | "dormant";
  isVip: boolean; isInBoarding: boolean; hasActiveTraining: boolean;
  appointmentsLast30: number;
  lastAppointment: { date: Date; startTime: string; serviceName: string | null } | null;
  nextAppointment: { date: Date; startTime: string; serviceName: string | null } | null;
  financial: { totalPaid: number; totalPending: number; hasDeposits: boolean };
  serviceTypes: string[];
}

function enrichCustomer(c: RawEnhancedCustomer): EnrichedCustomer {
  const tags: string[] = (() => { try { return JSON.parse(c.tags); } catch { return []; } })();
  const isVip = tags.some((t) => t.toLowerCase().includes("vip"));
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const pastAppts = c.appointments
    .filter((a) => new Date(a.date) <= now && a.status !== "canceled")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const futureAppts = c.appointments
    .filter((a) => new Date(a.date) > now && a.status === "scheduled")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const isInBoarding = c.boardingStays.length > 0;
  const hasActiveTraining = c.trainingPrograms.length > 0;
  const isActive =
    isInBoarding ||
    hasActiveTraining ||
    futureAppts.length > 0 ||
    new Date(c.createdAt) >= sevenDaysAgo;

  const lastAppt = pastAppts[0] ?? null;
  const nextAppt = futureAppts[0] ?? null;
  const totalPaid = c.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalPending = c.payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const serviceTypes = [
    ...new Set(c.appointments.map((a) => a.service?.type).filter((t): t is string => Boolean(t))),
  ];

  return {
    id: c.id, name: c.name, phone: c.phone, email: c.email,
    address: c.address, idNumber: c.idNumber, tags: c.tags,
    notes: c.notes, source: c.source, createdAt: c.createdAt,
    pets: c.pets, _count: c._count,
    status: isVip ? "vip" : isActive ? "active" : "dormant",
    isVip, isInBoarding, hasActiveTraining,
    appointmentsLast30: pastAppts.filter((a) => new Date(a.date) >= thirtyDaysAgo).length,
    lastAppointment: lastAppt
      ? { date: lastAppt.date, startTime: lastAppt.startTime, serviceName: lastAppt.service?.name ?? null }
      : null,
    nextAppointment: nextAppt
      ? { date: nextAppt.date, startTime: nextAppt.startTime, serviceName: nextAppt.service?.name ?? null }
      : null,
    financial: { totalPaid, totalPending, hasDeposits: c.payments.some((p) => p.isDeposit) },
    serviceTypes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Customers — list
// ─────────────────────────────────────────────────────────────────────────────

export interface CustomerListOptions {
  search?: string | null;
  tag?: string | null;
  enhanced?: boolean;
  serviceType?: string | null;
  cursor?: string;
  take?: number;
  sortBy?: "newest" | "oldest" | "name_asc";
  full?: boolean;
}

export type CustomerListResult =
  | { enhanced: true; customers: EnrichedCustomer[]; nextCursor: string | null; hasMore: boolean; total: number | null }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { enhanced: false; customers: any[]; nextCursor?: string | null; hasMore?: boolean; total?: number | null };

export async function listCustomers(
  businessId: string,
  db: DbClient,
  opts: CustomerListOptions = {}
): Promise<CustomerListResult> {
  const search = opts.search?.slice(0, 100) ?? null;
  const tag = opts.tag?.slice(0, 50) ?? null;
  const enhanced = opts.enhanced ?? false;
  const serviceType = opts.serviceType ?? null;
  const cursor = opts.cursor;
  const take = Math.min(Math.max(opts.take ?? 50, 1), 100);
  const sortBy = opts.sortBy ?? "newest";
  const full = opts.full ?? false;

  const orderBy =
    sortBy === "name_asc" ? [{ name: "asc" as const }, { id: "asc" as const }] :
    sortBy === "oldest"   ? [{ createdAt: "asc" as const }, { id: "asc" as const }] :
                            [{ createdAt: "desc" as const }, { id: "desc" as const }];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { businessId };
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
    ];
    if (enhanced) where.OR.push({ pets: { some: { name: { contains: search } } } });
  }
  if (tag) where.tags = { contains: tag };
  if (serviceType) where.appointments = { some: { service: { type: serviceType } } };

  // ── name_asc: Hebrew-first order via raw SQL ─────────────────────────────
  if (sortBy === "name_asc") {
    const offset = cursor && /^\d+$/.test(cursor) ? Math.min(parseInt(cursor, 10), 100_000) : 0;
    const searchFrag = search
      ? Prisma.sql`AND (c.name ILIKE ${`%${search}%`} OR c.phone LIKE ${`%${search}%`} OR c.email ILIKE ${`%${search}%`}
          OR EXISTS (SELECT 1 FROM "Pet" p WHERE p."customerId" = c.id AND p.name ILIKE ${`%${search}%`}))`
      : Prisma.sql``;
    const tagFrag = tag ? Prisma.sql`AND c.tags LIKE ${`%${tag}%`}` : Prisma.sql``;
    const stFrag = serviceType
      ? Prisma.sql`AND EXISTS (SELECT 1 FROM "Appointment" a LEFT JOIN "Service" s ON s.id = a."serviceId" WHERE a."customerId" = c.id AND s.type = ${serviceType})`
      : Prisma.sql``;

    const idRows = await db.$queryRaw<{ id: string }[]>`
      SELECT c.id FROM "Customer" c
      WHERE c."businessId" = ${businessId}
      ${searchFrag} ${tagFrag} ${stFrag}
      ORDER BY
        CASE
          WHEN coalesce(ascii(left(c.name, 1)), 0) BETWEEN 1488 AND 1514 THEN 0
          WHEN coalesce(ascii(left(c.name, 1)), 0) BETWEEN 65 AND 90
            OR coalesce(ascii(left(c.name, 1)), 0) BETWEEN 97 AND 122 THEN 1
          WHEN coalesce(ascii(left(c.name, 1)), 0) BETWEEN 48 AND 57 THEN 2
          ELSE 3
        END ASC, c.name ASC, c.id ASC
      LIMIT ${take + 1} OFFSET ${offset}
    `;

    const hasMore = idRows.length > take;
    const ids = idRows.slice(0, take).map((r) => r.id);
    const nextCursor = hasMore ? String(offset + take) : null;
    const total = !cursor ? await db.customer.count({ where }) : null;

    if (enhanced) {
      const fetched = await db.customer.findMany({ where: { id: { in: ids } }, include: ENHANCED_INCLUDE });
      const cmap = new Map(fetched.map((c) => [c.id, c]));
      const page = ids.map((id) => cmap.get(id)).filter(Boolean) as typeof fetched;
      return { enhanced: true, customers: page.map((c) => enrichCustomer(c as unknown as RawEnhancedCustomer)), nextCursor, hasMore, total };
    }

    const fetched = await db.customer.findMany({
      where: { id: { in: ids } },
      include: full
        ? { pets: { select: { id: true, name: true, species: true } } }
        : { _count: { select: { pets: true, appointments: true } } },
    });
    const cmap = new Map(fetched.map((c) => [c.id, c]));
    const ordered = ids.map((id) => cmap.get(id)).filter(Boolean);
    return { enhanced: false, customers: ordered, nextCursor, hasMore, total };
  }

  // ── Enhanced mode ────────────────────────────────────────────────────────
  if (enhanced) {
    const rows = await db.customer.findMany({
      where, take: take + 1, include: ENHANCED_INCLUDE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy,
    });
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;
    const total = !cursor ? await db.customer.count({ where }) : null;
    return { enhanced: true, customers: page.map((c) => enrichCustomer(c as unknown as RawEnhancedCustomer)), nextCursor, hasMore, total };
  }

  // ── Basic mode ───────────────────────────────────────────────────────────
  const rows = await db.customer.findMany({
    where,
    take: Math.min(take, 100),
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: full
      ? { pets: { select: { id: true, name: true, species: true } } }
      : { _count: { select: { pets: true, appointments: true } } },
    orderBy,
  });
  return { enhanced: false, customers: rows };
}
