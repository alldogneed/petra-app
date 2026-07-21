/**
 * Clients service — customers, leads, tasks.
 *
 * All functions: businessId first, db second, then args.
 * No Request/Response. Throws ServiceError on domain failures.
 *
 * Side effects (WhatsApp, GCal, engagement notifications) stay in the API route
 * because they are fire-and-forget and depend on session/request context.
 */

import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import {
  validateIsraeliPhone, validateEmail, sanitizeName, normalizeIsraeliPhone,
} from "@/lib/validation";
import {
  getMaxCustomers, getMaxLeads, getMaxTasks, normalizeTier,
} from "@/lib/feature-flags";
import { getFirstLeadStageId } from "@/lib/lead-stages";
import { scheduleLeadFollowup } from "@/lib/reminder-service";
import { ServiceError } from "./types";

export type DbClient = PrismaClient;
export { ServiceError };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function phoneToNorm(raw: string): string | null {
  try {
    const normalized = normalizeIsraeliPhone(raw);
    const digits = normalized.replace(/\D/g, "");
    if (digits.startsWith("972") && digits.length >= 11) return digits;
    if (digits.startsWith("0") && digits.length >= 9) return "972" + digits.slice(1);
    return digits || null;
  } catch {
    return null;
  }
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Customers — get
// ─────────────────────────────────────────────────────────────────────────────

export async function getCustomer(businessId: string, db: DbClient, customerId: string) {
  return db.customer.findFirst({
    where: { id: customerId, businessId },
    include: {
      pets: {
        include: { health: true, behavior: true, medications: { orderBy: { createdAt: "desc" }, take: 50 } },
      },
      appointments: {
        select: {
          id: true, date: true, startTime: true, endTime: true,
          status: true, notes: true, cancellationNote: true,
          service: { select: { id: true, name: true, color: true } },
          priceListItem: { select: { id: true, name: true } },
          pet: { select: { id: true, name: true, species: true } },
        },
        orderBy: { date: "desc" }, take: 100,
      },
      payments: {
        select: {
          id: true, amount: true, status: true, method: true,
          paidAt: true, createdAt: true, notes: true, isDeposit: true,
          appointment: { select: { id: true, date: true, service: { select: { name: true } } } },
          boardingStay: { select: { id: true, pet: { select: { name: true } }, room: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" }, take: 20,
      },
      orders: {
        select: {
          id: true, orderType: true, status: true, subtotal: true,
          discountAmount: true, taxTotal: true, total: true,
          notes: true, createdAt: true, startAt: true, endAt: true,
          lines: { select: { id: true, name: true, quantity: true, unitPrice: true, lineSubtotal: true, lineTotal: true } },
          payments: { select: { id: true, amount: true, status: true } },
        },
        orderBy: { createdAt: "desc" }, take: 20,
      },
      trainingPrograms: {
        select: {
          id: true, dogId: true, name: true, programType: true,
          status: true, startDate: true, totalSessions: true,
          frequency: true, notes: true, createdAt: true,
          dog: { select: { name: true } },
          goals: {
            select: { id: true, title: true, status: true, progressPercent: true, sortOrder: true },
            orderBy: { sortOrder: "asc" }, take: 30,
          },
          sessions: { where: { status: "COMPLETED" }, select: { id: true } },
        },
        orderBy: { createdAt: "desc" }, take: 20,
      },
      timelineEvents: {
        select: { id: true, type: true, description: true, metadata: true, createdAt: true },
        orderBy: { createdAt: "desc" }, take: 50,
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Customers — create
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateCustomerInput {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  idNumber?: string | null;
  secondContactName?: string | null;
  secondContactPhone?: string | null;
  notes?: string | null;
  tags?: string;
  source?: string;
}

export async function createCustomer(
  businessId: string,
  db: DbClient,
  input: CreateCustomerInput
) {
  // Tier limit
  const business = await db.business.findUnique({ where: { id: businessId }, select: { tier: true } });
  const maxCustomers = getMaxCustomers(business?.tier);
  if (maxCustomers !== null) {
    const count = await db.customer.count({ where: { businessId } });
    if (count >= maxCustomers) {
      throw new ServiceError(
        `הגעת לתקרת ${maxCustomers} הלקוחות במסלול החינמי. שדרג לבייסיק כדי להוסיף ללא הגבלה.`,
        "VALIDATION",
        { code: "LIMIT_REACHED" }
      );
    }
  }

  const safeName = sanitizeName(input.name);
  if (!safeName) throw new ServiceError("שם לא תקין", "VALIDATION");

  const phoneErr = validateIsraeliPhone(input.phone);
  if (phoneErr) throw new ServiceError(phoneErr, "VALIDATION");

  if (input.email) {
    const emailErr = validateEmail(input.email);
    if (emailErr) throw new ServiceError(emailErr, "VALIDATION");
  }
  if (input.notes && input.notes.length > 5000) throw new ServiceError("הערות ארוכות מדי (מקסימום 5000 תווים)", "VALIDATION");
  if (input.address && input.address.length > 500) throw new ServiceError("כתובת ארוכה מדי (מקסימום 500 תווים)", "VALIDATION");

  const normalizedPhone = normalizeIsraeliPhone(input.phone);
  const phoneNorm = phoneToNorm(input.phone);

  // Duplicate phone check
  if (phoneNorm) {
    const existing = await db.customer.findFirst({
      where: { businessId, phoneNorm },
      select: { id: true, name: true },
    });
    if (existing) {
      throw new ServiceError(
        `לקוח עם מספר טלפון זה כבר קיים במערכת (${existing.name})`,
        "CONFLICT",
        { code: "DUPLICATE_PHONE", existingId: existing.id }
      );
    }
  }

  let tags = "[]";
  if (input.tags) {
    try {
      const parsed = JSON.parse(input.tags);
      tags = Array.isArray(parsed) ? JSON.stringify(parsed) : "[]";
    } catch {
      tags = JSON.stringify(input.tags.split(",").map((t) => t.trim()).filter(Boolean));
    }
  }

  const customer = await db.customer.create({
    data: {
      name: safeName, phone: normalizedPhone, phoneNorm,
      email: input.email || null, address: input.address || null,
      idNumber: input.idNumber || null,
      secondContactName: input.secondContactName || null,
      secondContactPhone: input.secondContactPhone || null,
      notes: input.notes || null, tags,
      source: input.source || "manual",
      businessId,
    },
  });

  await db.timelineEvent.create({
    data: { type: "customer_created", description: `לקוח חדש נוצר: ${customer.name}`, customerId: customer.id, businessId },
  });

  return customer;
}

// ─────────────────────────────────────────────────────────────────────────────
// Customers — update
// ─────────────────────────────────────────────────────────────────────────────

export interface UpdateCustomerInput {
  name?: string;
  phone?: string;
  phoneNorm?: string | null;
  email?: string | null;
  address?: string | null;
  idNumber?: string | null;
  secondContactName?: string | null;
  secondContactPhone?: string | null;
  notes?: string | null;
  tags?: string | null;
  source?: string | null;
}

export async function updateCustomer(
  businessId: string,
  db: DbClient,
  customerId: string,
  input: UpdateCustomerInput
) {
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) data[k] = v;
  }

  if (input.name !== undefined) {
    const safeName = sanitizeName(input.name);
    if (!safeName) throw new ServiceError("שם לא תקין", "VALIDATION");
    data.name = safeName;
  }

  if (input.phone !== undefined) {
    const phoneErr = validateIsraeliPhone(input.phone);
    if (phoneErr) throw new ServiceError(phoneErr, "VALIDATION");
    const normalized = normalizeIsraeliPhone(input.phone);
    data.phone = normalized;
    const newPhoneNorm = phoneToNorm(input.phone);
    data.phoneNorm = newPhoneNorm;

    if (newPhoneNorm) {
      const duplicate = await db.customer.findFirst({
        where: { businessId, phoneNorm: newPhoneNorm, NOT: { id: customerId } },
        select: { id: true, name: true },
      });
      if (duplicate) {
        throw new ServiceError(
          `לקוח עם מספר טלפון זה כבר קיים במערכת (${duplicate.name})`,
          "CONFLICT",
          { code: "DUPLICATE_PHONE", existingId: duplicate.id }
        );
      }
    }
  }

  if (input.email) {
    const emailErr = validateEmail(input.email);
    if (emailErr) throw new ServiceError(emailErr, "VALIDATION");
  }

  // Length limits (match createCustomer)
  if (input.notes !== undefined && input.notes && (input.notes as string).length > 5000) {
    throw new ServiceError("הערות ארוכות מדי (מקסימום 5000 תווים)", "VALIDATION");
  }
  if (input.address !== undefined && input.address && (input.address as string).length > 500) {
    throw new ServiceError("כתובת ארוכה מדי (מקסימום 500 תווים)", "VALIDATION");
  }

  return db.customer.update({ where: { id: customerId, businessId }, data });
}

// ─────────────────────────────────────────────────────────────────────────────
// Customers — delete (cascade per CLAUDE.md rule #17)
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteCustomer(businessId: string, db: DbClient, customerId: string) {
  const customer = await db.customer.findFirst({ where: { id: customerId, businessId }, select: { id: true, name: true } });
  if (!customer) throw new ServiceError("Not found", "NOT_FOUND");

  const cid = customerId;
  await db.invoiceDocument.updateMany({ where: { customerId: cid }, data: { originalInvoiceId: null } });
  await db.invoiceDocument.deleteMany({ where: { customerId: cid } });
  await db.invoiceJob.deleteMany({ where: { customerId: cid } });
  await db.payment.deleteMany({ where: { customerId: cid } });
  await db.appointment.deleteMany({ where: { customerId: cid } });
  const orders = await db.order.findMany({ where: { customerId: cid }, select: { id: true } });
  if (orders.length > 0) await db.orderLine.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } });
  await db.order.deleteMany({ where: { customerId: cid } });
  await db.boardingStay.updateMany({ where: { customerId: cid }, data: { customerId: null } });
  await db.lead.updateMany({ where: { customerId: cid }, data: { customerId: null } });
  await db.trainingProgram.updateMany({ where: { customerId: cid }, data: { customerId: null } });
  await db.booking.deleteMany({ where: { customerId: cid } });
  await db.scheduledMessage.deleteMany({ where: { customerId: cid } });
  await db.contractRequest.deleteMany({ where: { customerId: cid } });
  await db.intakeForm.deleteMany({ where: { customerId: cid } });
  await db.timelineEvent.deleteMany({ where: { customerId: cid } });
  await db.serviceDogRecipient.deleteMany({ where: { customerId: cid } });
  await db.trainingGroupParticipant.deleteMany({ where: { customerId: cid } });
  await db.task.deleteMany({ where: { relatedEntityType: "CUSTOMER", relatedEntityId: cid } });
  await db.pet.deleteMany({ where: { customerId: cid } });
  await db.customer.delete({ where: { id: cid } });

  return customer;
}

// ─────────────────────────────────────────────────────────────────────────────
// Leads
// ─────────────────────────────────────────────────────────────────────────────

function leadPhoneToNorm(raw: string): string | null {
  try {
    const normalized = normalizeIsraeliPhone(raw);
    const digits = normalized.replace(/\D/g, "");
    if (digits.startsWith("972") && digits.length >= 11) return digits;
    if (digits.startsWith("0") && digits.length >= 9) return "972" + digits.slice(1);
    return null;
  } catch {
    return null;
  }
}

export async function listLeads(businessId: string, db: DbClient) {
  const leads = await db.lead.findMany({
    where: { businessId },
    include: { customer: true, callLogs: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  // Duplicate detection
  const normByLeadId = new Map<string, string>();
  for (const lead of leads) {
    if (lead.phone) {
      const norm = leadPhoneToNorm(lead.phone);
      if (norm) normByLeadId.set(lead.id, norm);
    }
  }
  const allNorms = [...new Set(normByLeadId.values())];
  const matchingCustomers = allNorms.length > 0
    ? await db.customer.findMany({
        where: { businessId, phoneNorm: { in: allNorms } },
        select: { id: true, name: true, phoneNorm: true },
      })
    : [];
  const normToCustomer = new Map(
    matchingCustomers.filter((c) => c.phoneNorm).map((c) => [c.phoneNorm!, { id: c.id, name: c.name }])
  );
  const normToLeads = new Map<string, { id: string; name: string }[]>();
  for (const lead of leads) {
    const norm = normByLeadId.get(lead.id);
    if (norm) {
      if (!normToLeads.has(norm)) normToLeads.set(norm, []);
      normToLeads.get(norm)!.push({ id: lead.id, name: lead.name });
    }
  }

  return leads.map((lead) => {
    const norm = normByLeadId.get(lead.id) ?? null;
    const existingCustomer = norm ? (normToCustomer.get(norm) ?? null) : null;
    const duplicateLead = norm
      ? (normToLeads.get(norm)?.find((l) => l.id !== lead.id) ?? null)
      : null;
    return { ...lead, existingCustomer, duplicateLead };
  });
}

export interface CreateLeadInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  requestedService?: string | null;
  source?: string;
  stage?: string;
  notes?: string | null;
  customerId?: string;
}

export async function createLead(businessId: string, db: DbClient, input: CreateLeadInput) {
  // Tier limit
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { tier: true, phone: true, name: true, featureOverrides: true },
  });
  const maxLeads = getMaxLeads(normalizeTier(business?.tier));
  if (maxLeads !== null) {
    const currentCount = await db.lead.count({ where: { businessId } });
    if (currentCount >= maxLeads) {
      throw new ServiceError(
        `הגעת לתקרת ${maxLeads} הלידים במסלול החינמי. שדרג לבייסיק כדי להוסיף ללא הגבלה.`,
        "VALIDATION",
        { code: "LIMIT_REACHED" }
      );
    }
  }

  const sanitizedName = sanitizeName(input.name);
  if (!sanitizedName || sanitizedName.length < 2) throw new ServiceError("שם לא תקין — נא להזין לפחות 2 תווים", "VALIDATION");

  if (input.email) {
    const emailErr = validateEmail(input.email);
    if (emailErr) throw new ServiceError(emailErr, "VALIDATION");
  }
  if (input.phone) {
    const phoneErr = validateIsraeliPhone(input.phone);
    if (phoneErr) throw new ServiceError(phoneErr, "VALIDATION");
  }
  if (input.notes && input.notes.length > 5000) throw new ServiceError("הערות ארוכות מדי (מקסימום 5000 תווים)", "VALIDATION");

  // Duplicate detection
  let existingCustomer: { id: string; name: string } | null = null;
  let duplicateLead: { id: string; name: string } | null = null;
  if (input.phone) {
    const norm = leadPhoneToNorm(input.phone);
    if (norm) {
      const dupCust = await db.customer.findFirst({
        where: { businessId, phoneNorm: norm },
        select: { id: true, name: true },
      });
      if (dupCust) existingCustomer = dupCust;

      const existingLeads = await db.lead.findMany({
        where: { businessId, phone: { not: null } },
        select: { id: true, name: true, phone: true },
      });
      for (const l of existingLeads) {
        if (l.phone && leadPhoneToNorm(l.phone) === norm) {
          duplicateLead = { id: l.id, name: l.name };
          break;
        }
      }
    }
  }

  // Stage resolution
  let resolvedStage = input.stage;
  if (input.stage) {
    const validStage = await db.leadStage.findFirst({ where: { id: input.stage, businessId } });
    if (!validStage) throw new ServiceError("Invalid stage value", "VALIDATION");
  } else {
    resolvedStage = await getFirstLeadStageId(businessId);
  }

  // IDOR: validate customerId belongs to this business
  if (input.customerId) {
    const customerCheck = await db.customer.findFirst({
      where: { id: input.customerId, businessId },
      select: { id: true },
    });
    if (!customerCheck) throw new ServiceError("לקוח לא נמצא", "NOT_FOUND");
  }

  const lead = await db.lead.create({
    data: {
      businessId, name: sanitizedName,
      phone: input.phone ?? undefined, email: input.email ?? undefined,
      city: input.city || null, address: input.address || null,
      requestedService: input.requestedService || null,
      source: input.source, stage: resolvedStage,
      notes: input.notes ?? undefined,
      customerId: input.customerId || undefined,
    },
    include: { customer: true, callLogs: true },
  });

  // lead_followup automation — hooked here ONCE so every createLead caller
  // (POST /api/leads, MCP create_lead) is covered without per-route duplication.
  // This only creates a ScheduledMessage DB row (the cron does the actual send),
  // so it does not violate the "WhatsApp sends stay in routes" convention above.
  // Awaited (Vercel kills detached promises); errors never fail the request.
  await scheduleLeadFollowup({
    id: lead.id,
    businessId,
    name: lead.name,
    phone: lead.phone,
    requestedService: lead.requestedService,
    customerId: lead.customerId,
  }).catch((err) => console.error("scheduleLeadFollowup (createLead) failed (non-critical):", err));

  return {
    lead,
    existingCustomer,
    duplicateLead,
    // caller needs these for WhatsApp notification
    business: business ? { tier: business.tier, phone: business.phone, featureOverrides: business.featureOverrides } : null,
  };
}

export interface UpdateLeadInput {
  stage?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  requestedService?: string | null;
  source?: string;
  notes?: string | null;
  lostReasonCode?: string | null;
  lostReasonText?: string | null;
  lastContactedAt?: string | null;
  wonAt?: string | null;
  lostAt?: string | null;
  nextFollowUpAt?: string | null;
  followUpStatus?: string | null;
  previousStageId?: string | null;
}

export async function updateLead(
  businessId: string,
  db: DbClient,
  leadId: string,
  input: UpdateLeadInput
) {
  const existing = await db.lead.findFirst({ where: { id: leadId, businessId } });
  if (!existing) throw new ServiceError("Lead not found", "NOT_FOUND");

  // Stage validation + won/lost auto-stamp
  let autoWonAt: Date | null | undefined;
  let autoLostAt: Date | null | undefined;
  if (input.stage !== undefined) {
    const validStage = await db.leadStage.findFirst({ where: { id: input.stage, businessId } });
    if (!validStage) throw new ServiceError("Invalid stage", "VALIDATION");
    if (input.stage !== existing.stage) {
      if (validStage.isWon) { autoWonAt = new Date(); autoLostAt = null; }
      else if (validStage.isLost) { autoLostAt = new Date(); autoWonAt = null; }
      else { autoWonAt = null; autoLostAt = null; }
    }
  }

  // ── Input validation (mirror createLead) ──
  if (input.name !== undefined) {
    const safeName = sanitizeName(input.name);
    if (!safeName || safeName.length < 2) throw new ServiceError("שם לא תקין — נא להזין לפחות 2 תווים", "VALIDATION");
    input.name = safeName;
  }
  if (input.email) {
    const emailErr = validateEmail(input.email);
    if (emailErr) throw new ServiceError(emailErr, "VALIDATION");
  }
  if (input.phone) {
    const phoneErr = validateIsraeliPhone(input.phone);
    if (phoneErr) throw new ServiceError(phoneErr, "VALIDATION");
  }
  if (input.notes !== undefined && input.notes && input.notes.length > 5000) throw new ServiceError("הערות ארוכות מדי (מקסימום 5000 תווים)", "VALIDATION");
  if (input.city !== undefined && input.city && input.city.length > 200) throw new ServiceError("שם עיר ארוך מדי (מקסימום 200 תווים)", "VALIDATION");
  if (input.address !== undefined && input.address && input.address.length > 500) throw new ServiceError("כתובת ארוכה מדי (מקסימום 500 תווים)", "VALIDATION");
  if (input.requestedService !== undefined && input.requestedService && input.requestedService.length > 500) throw new ServiceError("שם שירות ארוך מדי (מקסימום 500 תווים)", "VALIDATION");
  if (input.lostReasonText !== undefined && input.lostReasonText && input.lostReasonText.length > 1000) throw new ServiceError("סיבת אובדן ארוכה מדי (מקסימום 1000 תווים)", "VALIDATION");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    ...(input.stage !== undefined && { stage: input.stage }),
    ...(input.name !== undefined && { name: input.name }),
    ...(input.phone !== undefined && { phone: input.phone }),
    ...(input.email !== undefined && { email: input.email }),
    ...(input.city !== undefined && { city: input.city }),
    ...(input.address !== undefined && { address: input.address }),
    ...(input.requestedService !== undefined && { requestedService: input.requestedService }),
    ...(input.source !== undefined && { source: input.source }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.lostReasonCode !== undefined && { lostReasonCode: input.lostReasonCode }),
    ...(input.lostReasonText !== undefined && { lostReasonText: input.lostReasonText }),
    ...(input.lastContactedAt !== undefined && { lastContactedAt: input.lastContactedAt ? new Date(input.lastContactedAt) : null }),
    ...(input.wonAt !== undefined
      ? { wonAt: input.wonAt ? new Date(input.wonAt) : null }
      : autoWonAt !== undefined ? { wonAt: autoWonAt } : {}),
    ...(input.lostAt !== undefined
      ? { lostAt: input.lostAt ? new Date(input.lostAt) : null }
      : autoLostAt !== undefined ? { lostAt: autoLostAt } : {}),
    ...(input.nextFollowUpAt !== undefined && { nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null }),
    ...(input.followUpStatus !== undefined && { followUpStatus: input.followUpStatus }),
    ...(input.previousStageId !== undefined && { previousStageId: input.previousStageId }),
  };

  const lead = await db.lead.update({ where: { id: leadId, businessId }, data, include: { customer: true, callLogs: true } });

  // Follow-up task sync
  if (input.nextFollowUpAt !== undefined) {
    if (existing.followUpTaskId) {
      await db.task.deleteMany({
        where: { id: existing.followUpTaskId, businessId, status: { not: "COMPLETED" } },
      });
    }
    if (input.nextFollowUpAt) {
      const newTask = await db.task.create({
        data: {
          businessId, title: `מעקב עם ${existing.name}`,
          description: `מעקב עם ${existing.name}${existing.phone ? ` — ${existing.phone}` : ""}`,
          category: "LEADS", priority: "MEDIUM", status: "OPEN",
          dueDate: new Date(input.nextFollowUpAt),
          relatedEntityType: "LEAD", relatedEntityId: existing.id,
        },
      });
      await db.lead.update({ where: { id: leadId, businessId }, data: { followUpTaskId: newTask.id } });
    } else {
      await db.lead.update({ where: { id: leadId, businessId }, data: { followUpTaskId: null } });
    }
  }

  return lead;
}

export async function deleteLead(businessId: string, db: DbClient, leadId: string) {
  const existing = await db.lead.findFirst({ where: { id: leadId, businessId } });
  if (!existing) throw new ServiceError("Lead not found", "NOT_FOUND");

  await db.task.deleteMany({ where: { businessId, relatedEntityType: "LEAD", relatedEntityId: leadId } });

  try {
    await db.lead.delete({ where: { id: leadId, businessId } });
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2025") {
      return { alreadyDeleted: true };
    }
    throw err;
  }

  return { alreadyDeleted: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tasks
// ─────────────────────────────────────────────────────────────────────────────

export interface TaskListOptions {
  category?: string;
  status?: string;
  excludeCompleted?: boolean;
  from?: string;
  to?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

const VALID_CATEGORIES = ["BOARDING", "TRAINING", "LEADS", "GENERAL", "HEALTH", "MEDICATION", "FEEDING"];
const VALID_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELED"];
const VALID_ENTITY_TYPES = ["CUSTOMER", "DOG", "LEAD"];

export async function listTasks(businessId: string, db: DbClient, opts: TaskListOptions = {}) {
  const { category, status, excludeCompleted, from, to, relatedEntityType, relatedEntityId } = opts;

  if (category && !VALID_CATEGORIES.includes(category)) throw new ServiceError("Invalid category filter", "VALIDATION");
  if (status && !VALID_STATUSES.includes(status)) throw new ServiceError("Invalid status filter", "VALIDATION");
  if (relatedEntityType && !VALID_ENTITY_TYPES.includes(relatedEntityType)) throw new ServiceError("Invalid relatedEntityType filter", "VALIDATION");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { businessId };
  if (category) where.category = category;
  if (status) where.status = status;
  else if (excludeCompleted) where.status = { not: "COMPLETED" };
  if (relatedEntityType) where.relatedEntityType = relatedEntityType;
  if (relatedEntityId) where.relatedEntityId = relatedEntityId;

  if (from || to) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dateFilter: any = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const atFilter: any = {};
    if (from) {
      const d = new Date(from + "T00:00:00");
      if (isNaN(d.getTime())) throw new ServiceError("Invalid from date", "VALIDATION");
      dateFilter.gte = d; atFilter.gte = d;
    }
    if (to) {
      const d = new Date(to + "T23:59:59");
      if (isNaN(d.getTime())) throw new ServiceError("Invalid to date", "VALIDATION");
      dateFilter.lte = d; atFilter.lte = d;
    }
    where.OR = [{ dueDate: dateFilter }, { dueAt: atFilter }];
  }

  const tasks = await db.task.findMany({
    where,
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const customerIds = [...new Set(tasks.filter((t) => t.relatedEntityType === "CUSTOMER" && t.relatedEntityId).map((t) => t.relatedEntityId!))];
  const petIds = [...new Set(tasks.filter((t) => t.relatedEntityType === "DOG" && t.relatedEntityId).map((t) => t.relatedEntityId!))];
  const leadIds = [...new Set(tasks.filter((t) => t.relatedEntityType === "LEAD" && t.relatedEntityId).map((t) => t.relatedEntityId!))];

  const [relCustomers, relPets, relLeads] = await Promise.all([
    customerIds.length > 0 ? db.customer.findMany({ where: { id: { in: customerIds }, businessId }, select: { id: true, name: true } }) : [],
    petIds.length > 0 ? db.pet.findMany({ where: { id: { in: petIds }, customer: { businessId } }, select: { id: true, name: true, customerId: true } }) : [],
    leadIds.length > 0 ? db.lead.findMany({ where: { id: { in: leadIds }, businessId }, select: { id: true, name: true, lostAt: true, wonAt: true } }) : [],
  ]);

  const customerNameMap = new Map(relCustomers.map((c) => [c.id, c.name]));
  const petMap = new Map(relPets.map((p) => [p.id, { name: p.name, customerId: p.customerId }]));
  const leadNameMap = new Map(relLeads.map((l) => [l.id, l.name]));
  const closedLeadIds = new Set(relLeads.filter((l) => l.lostAt || l.wonAt).map((l) => l.id));

  const filtered = relatedEntityId
    ? tasks
    : tasks.filter((t) => t.relatedEntityType !== "LEAD" || !t.relatedEntityId || !closedLeadIds.has(t.relatedEntityId));

  return filtered.map((t) => ({
    ...t,
    relatedEntityName:
      t.relatedEntityType === "CUSTOMER" ? (customerNameMap.get(t.relatedEntityId!) ?? null) :
      t.relatedEntityType === "DOG"      ? (petMap.get(t.relatedEntityId!)?.name ?? null) :
      t.relatedEntityType === "LEAD"     ? (leadNameMap.get(t.relatedEntityId!) ?? null) : null,
    relatedEntityCustomerId:
      t.relatedEntityType === "CUSTOMER" ? t.relatedEntityId :
      t.relatedEntityType === "DOG"      ? (petMap.get(t.relatedEntityId!)?.customerId ?? null) : null,
    relatedEntityLeadId: t.relatedEntityType === "LEAD" ? t.relatedEntityId ?? null : null,
  }));
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  dueAt?: string;
  dueDate?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export async function createTask(businessId: string, db: DbClient, input: CreateTaskInput) {
  // Tier limit
  const business = await db.business.findUnique({ where: { id: businessId }, select: { tier: true } });
  const maxTasks = getMaxTasks(normalizeTier(business?.tier));
  if (maxTasks !== null) {
    const openCount = await db.task.count({
      where: { businessId, status: { notIn: ["COMPLETED", "CANCELED"] } },
    });
    if (openCount >= maxTasks) {
      throw new ServiceError(
        `מנוי חינמי מוגבל ל-${maxTasks} משימות פתוחות. שדרג לבייסיק כדי להוסיף עוד.`,
        "VALIDATION",
        { code: "LIMIT_REACHED" }
      );
    }
  }

  if (!input.title?.trim()) throw new ServiceError("Missing required field: title", "VALIDATION");
  if (input.title.length > 500) throw new ServiceError("כותרת משימה ארוכה מדי (מקסימום 500 תווים)", "VALIDATION");
  if (input.description && input.description.length > 5000) throw new ServiceError("תיאור משימה ארוך מדי (מקסימום 5000 תווים)", "VALIDATION");
  if (input.category && !VALID_CATEGORIES.includes(input.category)) throw new ServiceError("Invalid category value", "VALIDATION");
  if (input.priority && !["LOW", "MEDIUM", "HIGH", "URGENT"].includes(input.priority)) throw new ServiceError("Invalid priority value", "VALIDATION");
  if (input.status && !VALID_STATUSES.includes(input.status)) throw new ServiceError("Invalid status value", "VALIDATION");

  const safeTitle = sanitizeName(input.title) || input.title.trim();

  return db.task.create({
    data: {
      businessId, title: safeTitle,
      description: input.description,
      category: (input.category || "GENERAL") as "GENERAL",
      priority: (input.priority || "MEDIUM") as "MEDIUM",
      status: (input.status || "OPEN") as "OPEN",
      dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      relatedEntityType: input.relatedEntityType || undefined,
      relatedEntityId: input.relatedEntityId || undefined,
    },
  });
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  category?: string;
  priority?: string;
  status?: string;
  dueAt?: string | null;
  dueDate?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  reminderEnabled?: boolean;
}

export async function updateTask(
  businessId: string,
  db: DbClient,
  taskId: string,
  input: UpdateTaskInput,
  userId: string
) {
  const existing = await db.task.findFirst({
    where: { id: taskId, businessId },
    select: { id: true, status: true, relatedEntityType: true, relatedEntityId: true },
  });
  if (!existing) throw new ServiceError("Task not found", "NOT_FOUND");

  // Input validation (match createTask)
  if (input.title !== undefined) {
    if (!input.title.trim()) throw new ServiceError("Missing required field: title", "VALIDATION");
    if (input.title.length > 500) throw new ServiceError("כותרת משימה ארוכה מדי (מקסימום 500 תווים)", "VALIDATION");
  }
  if (input.description && input.description.length > 5000) throw new ServiceError("תיאור משימה ארוך מדי (מקסימום 5000 תווים)", "VALIDATION");
  if (input.category !== undefined && input.category && !VALID_CATEGORIES.includes(input.category)) throw new ServiceError("Invalid category value", "VALIDATION");
  if (input.priority !== undefined && input.priority && !["LOW", "MEDIUM", "HIGH", "URGENT"].includes(input.priority)) throw new ServiceError("Invalid priority value", "VALIDATION");
  if (input.status !== undefined && input.status && !VALID_STATUSES.includes(input.status)) throw new ServiceError("Invalid status value", "VALIDATION");

  const { title, description, category, priority, status, dueAt, dueDate, relatedEntityType, relatedEntityId, reminderEnabled } = input;

  const isCompleting = status === "COMPLETED" && existing.status !== "COMPLETED";
  const isReopening = status !== undefined && status !== "COMPLETED" && existing.status === "COMPLETED";

  const safeTitle = title !== undefined ? (sanitizeName(title) || title.trim()) : undefined;

  const task = await db.task.update({
    where: { id: taskId, businessId },
    data: {
      ...(safeTitle !== undefined && { title: safeTitle }),
      ...(description !== undefined && { description }),
      ...(category !== undefined && { category: category as "GENERAL" }),
      ...(priority !== undefined && { priority: priority as "MEDIUM" }),
      ...(status !== undefined && { status: status as "OPEN" }),
      ...(dueAt !== undefined && { dueAt: dueAt ? new Date(dueAt) : null }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(relatedEntityType !== undefined && { relatedEntityType }),
      ...(relatedEntityId !== undefined && { relatedEntityId }),
      ...(reminderEnabled !== undefined && { reminderEnabled }),
      ...(isCompleting && { completedAt: new Date() }),
      ...(isReopening && { completedAt: null }),
    },
  });

  // Sync back to lead if follow-up task
  if (existing.relatedEntityType === "LEAD" && existing.relatedEntityId) {
    if (isCompleting) {
      await db.lead.updateMany({
        where: { id: existing.relatedEntityId, followUpTaskId: taskId, businessId },
        data: { followUpStatus: "completed" },
      });
    } else if (isReopening) {
      await db.lead.updateMany({
        where: { id: existing.relatedEntityId, followUpTaskId: taskId, businessId },
        data: { followUpStatus: "pending" },
      });
    }
  }

  // Audit log (fire-and-forget — route responsibility, but we compute the label)
  const auditAction = isCompleting ? "COMPLETED" : isReopening ? "REOPENED" :
    status === "CANCELED" ? "CANCELED" : "UPDATED";
  db.taskAuditLog.create({
    data: { taskId, action: auditAction, userId, payload: JSON.stringify({ status, title, priority }) },
  }).catch((err) => console.error("Audit log error:", err));

  return task;
}

export async function getTask(businessId: string, db: DbClient, taskId: string) {
  return db.task.findFirst({ where: { id: taskId, businessId } });
}

export async function deleteTask(businessId: string, db: DbClient, taskId: string, userId: string) {
  const existing = await db.task.findFirst({
    where: { id: taskId, businessId },
    select: { id: true, title: true, relatedEntityType: true, relatedEntityId: true },
  });
  if (!existing) throw new ServiceError("Task not found", "NOT_FOUND");

  if (existing.relatedEntityType === "LEAD" && existing.relatedEntityId) {
    await db.lead.updateMany({
      where: { id: existing.relatedEntityId, followUpTaskId: taskId, businessId },
      data: { nextFollowUpAt: null, followUpTaskId: null, followUpStatus: "pending" },
    });
  }

  await db.taskAuditLog.create({
    data: { taskId, action: "DELETED", userId, payload: JSON.stringify({ title: existing.title }) },
  });

  await db.task.delete({ where: { id: taskId, businessId } });
  return existing;
}

/** Append a note to a customer's timeline (used by MCP add_client_note tool). */
export async function addCustomerNote(
  businessId: string,
  db: DbClient,
  customerId: string,
  note: string
) {
  if (!note || !note.trim()) throw new ServiceError("הערה ריקה", "VALIDATION");
  if (note.length > 2000) throw new ServiceError("הערה ארוכה מדי (מקסימום 2000 תווים)", "VALIDATION");

  const customer = await db.customer.findFirst({
    where: { id: customerId, businessId },
    select: { id: true, name: true },
  });
  if (!customer) throw new ServiceError("לקוח לא נמצא", "NOT_FOUND");

  await db.timelineEvent.create({
    data: {
      type: "MANUAL_NOTE",
      description: note.trim(),
      businessId,
      customerId,
    },
  });

  return { customerId, note: note.trim() };
}
