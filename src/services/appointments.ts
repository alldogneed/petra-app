/**
 * Appointments service — appointments and recurring scheduling.
 *
 * All functions: businessId first, db second, then args.
 * No Request/Response. Throws ServiceError on failure.
 *
 * Side effects (WhatsApp, reminders, GCal, timeline, booking creation)
 * stay in the API routes — never inside service functions.
 */

import type { PrismaClient } from "@prisma/client";
import { ServiceError } from "./types";

export type DbClient = PrismaClient;
export { ServiceError };

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AppointmentListOptions {
  from?: string;
  to?: string;
}

export interface CreateAppointmentInput {
  date: string;
  startTime: string;
  endTime: string;
  serviceId?: string | null;
  priceListItemId?: string | null;
  customerId: string;
  petId?: string | null;
  notes?: string | null;
}

export interface UpdateAppointmentInput {
  status?: "scheduled" | "completed" | "canceled";
  notes?: string | null;
  cancellationNote?: string | null;
  date?: string;
  startTime?: string;
  endTime?: string;
  serviceId?: string;
  priceListItemId?: string;
}

export interface RecurringAppointmentInput {
  date: string;
  startTime: string;
  endTime: string;
  serviceId?: string | null;
  priceListItemId?: string | null;
  customerId: string;
  petId?: string | null;
  notes?: string | null;
  repeatEvery: "week" | "2weeks" | "month";
  occurrences: number;
}

// Prisma select used for appointment responses
const APPOINTMENT_SELECT = {
  id: true, date: true, startTime: true, endTime: true,
  status: true, notes: true, cancellationNote: true,
  businessId: true, createdAt: true, updatedAt: true,
  serviceId: true, priceListItemId: true, customerId: true, petId: true,
  service: { select: { id: true, name: true, color: true, type: true, duration: true, price: true } },
  priceListItem: { select: { id: true, name: true, category: true, durationMinutes: true, basePrice: true } },
  customer: { select: { id: true, name: true, phone: true, email: true } },
  pet: { select: { id: true, name: true, species: true, breed: true } },
  staff: { select: { id: true, name: true } },
};

// ─────────────────────────────────────────────────────────────────────────────
// List appointments
// ─────────────────────────────────────────────────────────────────────────────

export async function listAppointments(businessId: string, db: DbClient, opts: AppointmentListOptions = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { businessId };

  if (opts.from || opts.to) {
    where.date = {};
    if (opts.from) {
      const d = new Date(opts.from);
      if (isNaN(d.getTime())) throw new ServiceError("Invalid from date", "VALIDATION");
      where.date.gte = d;
    }
    if (opts.to) {
      const d = new Date(opts.to);
      if (isNaN(d.getTime())) throw new ServiceError("Invalid to date", "VALIDATION");
      where.date.lte = d;
    }
  }

  return db.appointment.findMany({
    where,
    select: APPOINTMENT_SELECT,
    orderBy: { date: "asc" },
    take: 200,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Create appointment
// ─────────────────────────────────────────────────────────────────────────────

export async function createAppointment(
  businessId: string,
  db: DbClient,
  input: CreateAppointmentInput,
  opts: { maxAppointments?: number | null } = {}
) {
  const { date, startTime, endTime, serviceId, priceListItemId, customerId, petId, notes } = input;

  // Required field check
  if (!date || !startTime || !endTime || !customerId) {
    throw new ServiceError("Missing required fields: date, startTime, endTime, customerId", "VALIDATION");
  }
  if (notes && notes.length > 2000) {
    throw new ServiceError("הערות ארוכות מדי (מקסימום 2000 תווים)", "VALIDATION");
  }
  // An appointment must describe itself: a service, a price-list item, or at least
  // notes (e.g. a "[טיפוח]" category tag). This allows duplicating legacy/tag-only
  // appointments whose service was deleted — the hard service requirement made
  // "שכפל תור" fail on them.
  if (!serviceId && !priceListItemId && !notes) {
    throw new ServiceError("Either serviceId or priceListItemId is required", "VALIDATION");
  }

  // Time format validation
  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    throw new ServiceError("startTime and endTime must be in HH:mm format", "VALIDATION");
  }
  if (startTime >= endTime) {
    throw new ServiceError("startTime must be before endTime", "VALIDATION");
  }

  // Appointment limit check
  if (opts.maxAppointments !== null && opts.maxAppointments !== undefined) {
    const totalCount = await db.appointment.count({
      where: { businessId, status: { notIn: ["CANCELED"] } },
    });
    if (totalCount >= opts.maxAppointments) {
      throw new ServiceError(
        `הגעת לתקרת ${opts.maxAppointments} התורים במסלול החינמי. שדרג לבייסיק כדי להוסיף ללא הגבלה.`,
        "VALIDATION",
        { code: "LIMIT_REACHED" }
      );
    }
  }

  // IDOR: validate all referenced IDs belong to this business
  const customer = await db.customer.findFirst({ where: { id: customerId, businessId }, select: { id: true } });
  if (!customer) throw new ServiceError("לקוח לא נמצא", "NOT_FOUND");

  if (petId) {
    const pet = await db.pet.findFirst({
      where: { id: petId, OR: [{ customer: { businessId } }, { businessId }] },
      select: { id: true },
    });
    if (!pet) throw new ServiceError("חיית מחמד לא נמצאה", "NOT_FOUND");
  }

  if (serviceId) {
    const svc = await db.service.findFirst({ where: { id: serviceId, businessId }, select: { id: true } });
    if (!svc) throw new ServiceError("שירות לא נמצא", "NOT_FOUND");
  }

  if (priceListItemId) {
    const pli = await db.priceListItem.findFirst({
      where: { id: priceListItemId, priceList: { businessId } },
      select: { id: true },
    });
    if (!pli) throw new ServiceError("פריט מחירון לא נמצא", "NOT_FOUND");
  }

  return db.appointment.create({
    data: {
      date: new Date(date),
      startTime,
      endTime,
      serviceId: serviceId || null,
      priceListItemId: priceListItemId || null,
      customerId,
      petId: petId || null,
      notes: notes || null,
      status: "scheduled",
      businessId,
    },
    select: APPOINTMENT_SELECT,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Update appointment
// ─────────────────────────────────────────────────────────────────────────────

export async function updateAppointment(businessId: string, db: DbClient, id: string, input: UpdateAppointmentInput) {
  const existing = await db.appointment.findFirst({ where: { id, businessId } });
  if (!existing) throw new ServiceError("Appointment not found", "NOT_FOUND");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (input.status !== undefined) data.status = input.status;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.cancellationNote !== undefined) data.cancellationNote = input.cancellationNote;
  if (input.date !== undefined) data.date = new Date(input.date);
  if (input.startTime !== undefined) data.startTime = input.startTime;
  if (input.endTime !== undefined) data.endTime = input.endTime;

  // IDOR: validate serviceId / priceListItemId belong to this business
  if (input.serviceId !== undefined) {
    const svc = await db.service.findFirst({ where: { id: input.serviceId, businessId } });
    if (!svc) throw new ServiceError("שירות לא נמצא", "VALIDATION");
    data.serviceId = input.serviceId;
  }
  if (input.priceListItemId !== undefined) {
    const pli = await db.priceListItem.findFirst({
      where: { id: input.priceListItemId, priceList: { businessId } },
    });
    if (!pli) throw new ServiceError("פריט מחירון לא נמצא", "VALIDATION");
    data.priceListItemId = input.priceListItemId;
  }

  return db.appointment.update({
    where: { id, businessId },
    data,
    include: {
      service: { select: { id: true, name: true, color: true, type: true, duration: true, price: true } },
      priceListItem: { select: { id: true, name: true, category: true, durationMinutes: true, basePrice: true } },
      customer: { select: { id: true, name: true, phone: true } },
      pet: { select: { id: true, name: true, species: true, breed: true } },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete appointment (DB only — route handles GCal + reminder side effects)
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteAppointment(businessId: string, db: DbClient, id: string) {
  const existing = await db.appointment.findFirst({
    where: { id, businessId },
    include: {
      customer: { select: { name: true } },
      service: { select: { name: true } },
    },
  });
  if (!existing) throw new ServiceError("Appointment not found", "NOT_FOUND");

  await db.appointment.delete({ where: { id, businessId } });
  return existing;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recurring appointments
// ─────────────────────────────────────────────────────────────────────────────

export async function createRecurringAppointments(businessId: string, db: DbClient, input: RecurringAppointmentInput) {
  const { date, startTime, endTime, serviceId, priceListItemId, customerId, petId, notes, repeatEvery, occurrences } = input;

  if (!date || !startTime || !endTime || !customerId) {
    throw new ServiceError("Missing required fields", "VALIDATION");
  }
  // Allow serviceless appointments that carry descriptive notes (tag-only), matching createAppointment.
  if (!serviceId && !priceListItemId && !notes) {
    throw new ServiceError("Either serviceId or priceListItemId is required", "VALIDATION");
  }

  // Time format validation
  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    throw new ServiceError("startTime and endTime must be in HH:mm format", "VALIDATION");
  }
  if (startTime >= endTime) {
    throw new ServiceError("startTime must be before endTime", "VALIDATION");
  }
  if (notes && notes.length > 2000) {
    throw new ServiceError("הערות ארוכות מדי (מקסימום 2000 תווים)", "VALIDATION");
  }

  // IDOR: validate all referenced IDs belong to this business
  const customer = await db.customer.findFirst({ where: { id: customerId, businessId }, select: { id: true } });
  if (!customer) throw new ServiceError("לקוח לא נמצא", "NOT_FOUND");

  if (petId) {
    const pet = await db.pet.findFirst({
      where: { id: petId, OR: [{ customer: { businessId } }, { businessId }] },
      select: { id: true },
    });
    if (!pet) throw new ServiceError("חיית מחמד לא נמצאה", "NOT_FOUND");
  }

  if (serviceId) {
    const svc = await db.service.findFirst({ where: { id: serviceId, businessId }, select: { id: true } });
    if (!svc) throw new ServiceError("שירות לא נמצא", "NOT_FOUND");
  }

  if (priceListItemId) {
    const pli = await db.priceListItem.findFirst({
      where: { id: priceListItemId, priceList: { businessId } },
      select: { id: true },
    });
    if (!pli) throw new ServiceError("פריט מחירון לא נמצא", "NOT_FOUND");
  }

  const count = Math.min(Math.max(Number(occurrences) || 1, 1), 52);
  const intervalDays = repeatEvery === "2weeks" ? 14 : repeatEvery === "month" ? 28 : 7;

  const baseDate = new Date(date);
  const data = Array.from({ length: count }, (_, i) => {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i * intervalDays);
    return {
      date: d,
      startTime,
      endTime,
      serviceId: serviceId || null,
      priceListItemId: priceListItemId || null,
      customerId,
      petId: petId || null,
      notes: notes || null,
      status: "scheduled",
      businessId,
    };
  });

  const result = await db.appointment.createMany({ data });
  return { created: result.count };
}
