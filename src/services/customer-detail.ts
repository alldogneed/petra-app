/**
 * Customer card — summary + paged sub-resources (appointments, payments, timeline)
 * and note edit/delete. businessId first, db second. Throws ServiceError.
 *
 * Shapes: the appointment / payment item selects below are THE item shapes of
 * `getCustomer()` (src/services/clients.ts) and of the paged endpoints
 * GET /api/customers/[id]/{appointments,payments,timeline}.
 */

import type { PrismaClient, Prisma } from "@prisma/client";
import { computeCustomerBalance, type CustomerBalance } from "@/lib/customer-balance";
import {
  CANCELED_APPOINTMENT_STATUSES, NON_VISIT_APPOINTMENT_STATUSES,
  israelTodayBounds, israelNowHHMM, pageOf, isEditableTimelineType,
  type AppointmentScope,
} from "@/lib/customer-summary";
import { ServiceError } from "./types";

type Db = PrismaClient;

// ─── Item shapes ──────────────────────────────────────────────────────────────

export const CUSTOMER_APPOINTMENT_SELECT = {
  id: true, date: true, startTime: true, endTime: true,
  status: true, notes: true, cancellationNote: true,
  service: { select: { id: true, name: true, color: true } },
  priceListItem: { select: { id: true, name: true } },
  pet: { select: { id: true, name: true, species: true } },
} satisfies Prisma.AppointmentSelect;

export const CUSTOMER_PAYMENT_SELECT = {
  id: true, amount: true, status: true, method: true,
  paidAt: true, createdAt: true, notes: true, isDeposit: true,
  appointment: { select: { id: true, date: true, service: { select: { name: true } } } },
  boardingStay: { select: { id: true, pet: { select: { name: true } }, room: { select: { name: true } } } },
} satisfies Prisma.PaymentSelect;

export const CUSTOMER_TIMELINE_SELECT = {
  id: true, type: true, description: true, metadata: true, createdAt: true,
} satisfies Prisma.TimelineEventSelect;

export type CustomerAppointmentItem = Prisma.AppointmentGetPayload<{ select: typeof CUSTOMER_APPOINTMENT_SELECT }>;
export type CustomerPaymentItem = Prisma.PaymentGetPayload<{ select: typeof CUSTOMER_PAYMENT_SELECT }>;
export type CustomerTimelineItem = Prisma.TimelineEventGetPayload<{ select: typeof CUSTOMER_TIMELINE_SELECT }>;

// ─── Summary ──────────────────────────────────────────────────────────────────

export interface CustomerSummary {
  /** null when the caller lacks FINANCE_READ (the route nulls it). */
  balance: CustomerBalance | null;
  counts: {
    appointments: number;
    /** Same filter as GET …/appointments?scope=upcoming (date ≥ Israel today, not canceled). */
    upcomingAppointments: number;
    /** Same filter as lastVisit (before now, not canceled / no-show). */
    pastVisits: number;
    payments: number;
    orders: number;
    timelineEvents: number;
    pets: number;
  };
  nextAppointment: { id: string; date: Date; startTime: string; serviceName: string | null; petName: string | null } | null;
  lastVisit: { id: string; date: Date; startTime: string; serviceName: string | null } | null;
}

function upcomingWhere(businessId: string, customerId: string, todayStart: Date): Prisma.AppointmentWhereInput {
  return {
    businessId, customerId,
    date: { gte: todayStart },
    status: { notIn: [...CANCELED_APPOINTMENT_STATUSES] },
  };
}

/** Appointment before "now" (Israel), counted as a visit. */
function pastVisitWhere(businessId: string, customerId: string, now: Date): Prisma.AppointmentWhereInput {
  const { todayStart, tomorrowStart } = israelTodayBounds(now);
  return {
    businessId, customerId,
    status: { notIn: [...NON_VISIT_APPOINTMENT_STATUSES] },
    OR: [
      { date: { lt: todayStart } },
      { date: { gte: todayStart, lt: tomorrowStart }, startTime: { lte: israelNowHHMM(now) } },
    ],
  };
}

export async function getCustomerSummary(
  businessId: string,
  db: Db,
  customerId: string,
  now: Date = new Date()
): Promise<CustomerSummary> {
  const { todayStart } = israelTodayBounds(now);
  const own = { businessId, customerId };

  const [balance, appointments, upcomingAppointments, pastVisits, payments, orders, timelineEvents, pets, next, last] =
    await Promise.all([
      computeCustomerBalance(db, businessId, customerId),
      db.appointment.count({ where: own }),
      db.appointment.count({ where: upcomingWhere(businessId, customerId, todayStart) }),
      db.appointment.count({ where: pastVisitWhere(businessId, customerId, now) }),
      db.payment.count({ where: own }),
      db.order.count({ where: own }),
      db.timelineEvent.count({ where: own }),
      // Pet has no businessId of its own for customer-owned pets — scope via the customer.
      db.pet.count({ where: { customerId, customer: { businessId } } }),
      db.appointment.findFirst({
        where: { ...own, date: { gte: todayStart }, status: "scheduled" },
        orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }],
        select: {
          id: true, date: true, startTime: true,
          service: { select: { name: true } },
          priceListItem: { select: { name: true } },
          pet: { select: { name: true } },
        },
      }),
      db.appointment.findFirst({
        where: pastVisitWhere(businessId, customerId, now),
        orderBy: [{ date: "desc" }, { startTime: "desc" }, { id: "desc" }],
        select: {
          id: true, date: true, startTime: true,
          service: { select: { name: true } },
          priceListItem: { select: { name: true } },
        },
      }),
    ]);

  return {
    balance,
    counts: { appointments, upcomingAppointments, pastVisits, payments, orders, timelineEvents, pets },
    nextAppointment: next
      ? {
          id: next.id, date: next.date, startTime: next.startTime,
          serviceName: next.service?.name ?? next.priceListItem?.name ?? null,
          petName: next.pet?.name ?? null,
        }
      : null,
    lastVisit: last
      ? {
          id: last.id, date: last.date, startTime: last.startTime,
          serviceName: last.service?.name ?? last.priceListItem?.name ?? null,
        }
      : null,
  };
}

// ─── Shared guards ────────────────────────────────────────────────────────────

async function assertCustomer(db: Db, businessId: string, customerId: string): Promise<{ id: string; name: string }> {
  const c = await db.customer.findFirst({ where: { id: customerId, businessId }, select: { id: true, name: true } });
  if (!c) throw new ServiceError("לקוח לא נמצא", "NOT_FOUND");
  return c;
}

// ─── Appointments (paged) ─────────────────────────────────────────────────────

export interface PagedResult<T> { items: T[]; nextCursor: string | null; total: number }

export async function listCustomerAppointments(
  businessId: string,
  db: Db,
  customerId: string,
  opts: { scope: AppointmentScope; cursor: string | null; take: number; now?: Date }
): Promise<PagedResult<CustomerAppointmentItem>> {
  await assertCustomer(db, businessId, customerId);
  const { todayStart } = israelTodayBounds(opts.now ?? new Date());
  const upcoming = upcomingWhere(businessId, customerId, todayStart);
  // past = everything that is not "upcoming" (older days + canceled future ones).
  const where: Prisma.AppointmentWhereInput =
    opts.scope === "upcoming" ? upcoming : { businessId, customerId, NOT: upcoming };
  const dir = opts.scope === "upcoming" ? "asc" : "desc";

  if (opts.cursor) {
    const ok = await db.appointment.findFirst({ where: { ...where, id: opts.cursor }, select: { id: true } });
    if (!ok) throw new ServiceError("cursor לא תקין", "VALIDATION");
  }

  const [rows, total] = await Promise.all([
    db.appointment.findMany({
      where,
      select: CUSTOMER_APPOINTMENT_SELECT,
      orderBy: [{ date: dir }, { startTime: dir }, { id: dir }],
      take: opts.take + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    }),
    db.appointment.count({ where }),
  ]);
  const { items, nextCursor } = pageOf(rows, opts.take);
  return { items, nextCursor, total };
}

// ─── Payments (paged) ─────────────────────────────────────────────────────────

export async function listCustomerPayments(
  businessId: string,
  db: Db,
  customerId: string,
  opts: { cursor: string | null; take: number }
): Promise<PagedResult<CustomerPaymentItem>> {
  await assertCustomer(db, businessId, customerId);
  const where: Prisma.PaymentWhereInput = { businessId, customerId };

  if (opts.cursor) {
    const ok = await db.payment.findFirst({ where: { ...where, id: opts.cursor }, select: { id: true } });
    if (!ok) throw new ServiceError("cursor לא תקין", "VALIDATION");
  }

  const [rows, total] = await Promise.all([
    db.payment.findMany({
      where,
      select: CUSTOMER_PAYMENT_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: opts.take + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    }),
    db.payment.count({ where }),
  ]);
  const { items, nextCursor } = pageOf(rows, opts.take);
  return { items, nextCursor, total };
}

// ─── Timeline (paged) + note edit / delete ────────────────────────────────────

export async function listCustomerTimeline(
  businessId: string,
  db: Db,
  customerId: string,
  opts: { cursor: string | null; take: number }
): Promise<{ items: CustomerTimelineItem[]; nextCursor: string | null }> {
  await assertCustomer(db, businessId, customerId);
  const where: Prisma.TimelineEventWhereInput = { businessId, customerId };

  if (opts.cursor) {
    const ok = await db.timelineEvent.findFirst({ where: { ...where, id: opts.cursor }, select: { id: true } });
    if (!ok) throw new ServiceError("cursor לא תקין", "VALIDATION");
  }

  const rows = await db.timelineEvent.findMany({
    where,
    select: CUSTOMER_TIMELINE_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: opts.take + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  return pageOf(rows, opts.take);
}

/** Loads a note of THIS customer in THIS business; throws NOT_FOUND / VALIDATION. */
async function loadEditableNote(db: Db, businessId: string, customerId: string, eventId: string) {
  if (!customerId || !eventId) throw new ServiceError("לא נמצא", "NOT_FOUND");
  const customer = await assertCustomer(db, businessId, customerId);
  const event = await db.timelineEvent.findFirst({
    where: { id: eventId, customerId, businessId },
    select: { id: true, type: true },
  });
  if (!event) throw new ServiceError("האירוע לא נמצא", "NOT_FOUND");
  if (!isEditableTimelineType(event.type)) throw new ServiceError("ניתן לערוך רק הערות", "VALIDATION");
  return { customer, event };
}

export async function updateCustomerNote(
  businessId: string,
  db: Db,
  customerId: string,
  eventId: string,
  description: string
): Promise<{ event: CustomerTimelineItem; customerName: string }> {
  const { customer } = await loadEditableNote(db, businessId, customerId, eventId);
  // Scoped updateMany (no bare-id update) — then read back.
  const res = await db.timelineEvent.updateMany({
    where: { id: eventId, customerId, businessId },
    data: { description },
  });
  if (res.count === 0) throw new ServiceError("האירוע לא נמצא", "NOT_FOUND");
  const event = await db.timelineEvent.findFirst({
    where: { id: eventId, customerId, businessId },
    select: CUSTOMER_TIMELINE_SELECT,
  });
  if (!event) throw new ServiceError("האירוע לא נמצא", "NOT_FOUND");
  return { event, customerName: customer.name };
}

export async function deleteCustomerNote(
  businessId: string,
  db: Db,
  customerId: string,
  eventId: string
): Promise<{ customerName: string }> {
  const { customer } = await loadEditableNote(db, businessId, customerId, eventId);
  const res = await db.timelineEvent.deleteMany({ where: { id: eventId, customerId, businessId } });
  if (res.count === 0) throw new ServiceError("האירוע לא נמצא", "NOT_FOUND");
  return { customerName: customer.name };
}

// ─── Documents (JSON string column) — optimistic concurrency ─────────────────

export interface CustomerDocument { id: string; url?: string; [k: string]: unknown }

function parseDocs(raw: string | null | undefined): CustomerDocument[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function getCustomerDocuments(businessId: string, db: Db, customerId: string): Promise<CustomerDocument[]> {
  const c = await db.customer.findFirst({ where: { id: customerId, businessId }, select: { documents: true } });
  if (!c) throw new ServiceError("Customer not found", "NOT_FOUND");
  return parseDocs(c.documents);
}

/**
 * Read-modify-write of `Customer.documents` with compare-and-swap on the old string
 * (no $transaction — PgBouncer). Retries up to `attempts` times; CONFLICT if another
 * writer keeps winning. `mutate` receives the current list and returns the new one
 * (+ any value to hand back to the caller).
 */
export async function mutateCustomerDocuments<R>(
  businessId: string,
  db: Db,
  customerId: string,
  mutate: (docs: CustomerDocument[]) => { docs: CustomerDocument[]; result: R },
  attempts = 3
): Promise<R> {
  for (let i = 0; i < attempts; i++) {
    const c = await db.customer.findFirst({ where: { id: customerId, businessId }, select: { documents: true } });
    if (!c) throw new ServiceError("Customer not found", "NOT_FOUND");
    const { docs, result } = mutate(parseDocs(c.documents));
    const res = await db.customer.updateMany({
      where: { id: customerId, businessId, documents: c.documents },
      data: { documents: JSON.stringify(docs) },
    });
    if (res.count === 1) return result;
  }
  throw new ServiceError("המסמכים עודכנו במקביל — נסה שוב", "CONFLICT");
}
