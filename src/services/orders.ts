/**
 * Orders service — orders, order lines.
 *
 * businessId first, db second, then args.
 * No Request/Response. Throws ServiceError on failure.
 *
 * Side effects (WhatsApp, GCal, reminder scheduling, activity logging)
 * stay in routes.
 */

import type { PrismaClient } from "@prisma/client";
import { ServiceError } from "./types";
import { calcOrder } from "@/lib/order-calc";
import type { CalcLineInput } from "@/lib/order-calc";

export type DbClient = PrismaClient;
export { ServiceError };

const VALID_ORDER_STATUSES = ["draft", "confirmed", "in_progress", "completed", "cancelled"];
const APPT_ORDER_TYPES = ["training", "grooming", "service_dog"];
const APPT_TYPE_LABELS: Record<string, string> = { training: "אילוף", grooming: "טיפוח", service_dog: "כלב שירות" };
const TRAINING_SUBTYPE_LABELS: Record<string, string> = { individual: "פרטי", group: "קבוצתי", boarding: "פנסיון", package: "חבילה" };

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ListOrdersOptions {
  status?: string;
  customerId?: string;
  from?: string;
  to?: string;
  startFrom?: string;
  startTo?: string;
}

export interface OrderLineInput {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxMode?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any;
  priceListItemId?: string | null;
}

export interface AppointmentDataInput {
  date: string;
  startTime: string;
  endTime: string;
  serviceId?: string | null;
  petId?: string | null;
}

export interface CreateOrderInput {
  customerId: string;
  orderType?: string;
  startAt?: string | null;
  endAt?: string | null;
  lines: OrderLineInput[];
  discountType?: string;
  discountValue?: number;
  notes?: string | null;
  status?: string;
  appointmentData?: AppointmentDataInput | null;
  trainingSubType?: string | null;
  trainingPackageId?: string | null;
  trainingBoardingStart?: string | null;
  trainingBoardingEnd?: string | null;
  assignedToUserId?: string | null;
  trainingGroupId?: string | null;
  petId?: string | null;
  programType?: string | null;
}

export interface UpdateOrderData {
  status?: string;
  notes?: string | null;
  orderType?: string;
}

export interface CreateOrderResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any;
  linkedAppointmentId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// List orders
// ─────────────────────────────────────────────────────────────────────────────

export async function listOrders(businessId: string, db: DbClient, opts: ListOrdersOptions = {}) {
  if (opts.status && !VALID_ORDER_STATUSES.includes(opts.status)) {
    throw new ServiceError("סטטוס הזמנה לא תקין", "VALIDATION");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { businessId };
  if (opts.status) where.status = opts.status;
  if (opts.customerId) where.customerId = opts.customerId;
  if (opts.from || opts.to) {
    where.createdAt = {
      ...(opts.from ? { gte: new Date(opts.from + "T00:00:00") } : {}),
      ...(opts.to ? { lte: new Date(opts.to + "T23:59:59") } : {}),
    };
  }
  if (opts.startFrom || opts.startTo) {
    where.startAt = {
      ...(opts.startFrom ? { gte: new Date(opts.startFrom + "T00:00:00") } : {}),
      ...(opts.startTo ? { lte: new Date(opts.startTo + "T23:59:59") } : {}),
    };
  }

  return db.order.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      lines: true,
      payments: { select: { id: true, amount: true, status: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Get order
// ─────────────────────────────────────────────────────────────────────────────

export async function getOrder(businessId: string, db: DbClient, id: string) {
  const order = await db.order.findFirst({
    where: { id, businessId },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      lines: {
        include: { priceListItem: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      payments: true,
    },
  });
  if (!order) throw new ServiceError("Order not found", "NOT_FOUND");
  return order;
}

// ─────────────────────────────────────────────────────────────────────────────
// Create order
// ─────────────────────────────────────────────────────────────────────────────

export async function createOrder(
  businessId: string,
  db: DbClient,
  input: CreateOrderInput,
  opts: { maxOrders?: number | null } = {}
): Promise<CreateOrderResult> {
  const {
    customerId, orderType, startAt, endAt, lines, discountType, discountValue,
    notes, status, appointmentData, trainingSubType, trainingPackageId,
    trainingBoardingStart, trainingBoardingEnd, assignedToUserId, trainingGroupId, petId, programType,
  } = input;

  // Input validation
  if (!customerId || !lines || !Array.isArray(lines) || lines.length === 0) {
    throw new ServiceError("customerId and at least one line are required", "VALIDATION");
  }
  if (lines.length > 100) throw new ServiceError("מקסימום 100 שורות להזמנה", "VALIDATION");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l || typeof l !== "object") throw new ServiceError(`שורה ${i + 1}: פריט לא תקין`, "VALIDATION");
    if (typeof l.quantity !== "number" || l.quantity <= 0 || !isFinite(l.quantity)) {
      throw new ServiceError(`שורה ${i + 1}: כמות לא תקינה`, "VALIDATION");
    }
    if (typeof l.unitPrice !== "number" || l.unitPrice < 0 || !isFinite(l.unitPrice)) {
      throw new ServiceError(`שורה ${i + 1}: מחיר לא תקין`, "VALIDATION");
    }
  }
  if (notes && typeof notes === "string" && notes.length > 2000) {
    throw new ServiceError("הערות ארוכות מדי (מקסימום 2000 תווים)", "VALIDATION");
  }

  // IDOR checks
  const customerCheck = await db.customer.findFirst({ where: { id: customerId, businessId }, select: { id: true } });
  if (!customerCheck) throw new ServiceError("לקוח לא נמצא", "NOT_FOUND");

  if (assignedToUserId) {
    const membership = await db.businessUser.findUnique({
      where: { businessId_userId: { businessId, userId: assignedToUserId } },
      select: { id: true, isActive: true },
    });
    if (!membership || !membership.isActive) throw new ServiceError("איש הצוות לא נמצא בעסק זה", "VALIDATION");
  }

  // Tier limit check
  if (opts.maxOrders !== null && opts.maxOrders !== undefined) {
    const orderCount = await db.order.count({ where: { businessId } });
    if (orderCount >= opts.maxOrders) {
      throw new ServiceError(
        `הגעת לתקרת ${opts.maxOrders} ההזמנות במסלול החינמי. שדרג לבייסיק כדי להוסיף ללא הגבלה.`,
        "UNAUTHORIZED",
        { code: "LIMIT_REACHED" }
      );
    }
  }

  // Fetch business VAT settings
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { vatEnabled: true, vatRate: true, legalEntityType: true },
  });
  if (!business) throw new ServiceError("Business not found", "NOT_FOUND");

  // Calculate order totals
  const calcInput: CalcLineInput[] = lines.map((l) => ({
    name: l.name,
    unit: l.unit,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    taxMode: (l.taxMode || "taxable") as "inherit" | "taxable" | "exempt",
  }));
  const calc = calcOrder({
    lines: calcInput,
    discountType: (discountType || "none") as "none" | "percent" | "fixed",
    discountValue: discountValue || 0,
    vatEnabled: business.legalEntityType === "עוסק פטור" ? false : business.vatEnabled,
    vatRate: business.vatRate,
  });

  let linkedAppointmentId: string | null = null;

  // Create order
  const created = await db.order.create({
    data: {
      businessId,
      customerId,
      orderType: orderType || "sale",
      status: status || "draft",
      startAt: startAt ? new Date(startAt) : undefined,
      endAt: endAt ? new Date(endAt) : undefined,
      subtotal: calc.subtotal,
      discountType: discountType || "none",
      discountValue: discountValue || 0,
      discountAmount: calc.discountAmount,
      taxTotal: calc.taxTotal,
      total: calc.total,
      notes: notes || null,
      assignedToUserId: assignedToUserId || null,
    },
  });

  // Create lines (sequential — Supabase PgBouncer)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const cl = calc.lines[i];
    await db.orderLine.create({
      data: {
        orderId: created.id,
        businessId,
        priceListItemId: l.priceListItemId || null,
        name: cl.name,
        unit: cl.unit,
        quantity: cl.quantity,
        unitPrice: cl.unitPrice,
        lineSubtotal: cl.lineSubtotal,
        lineTax: cl.lineTax,
        lineTotal: cl.lineTotal,
        taxMode: cl.taxMode,
        metadata: l.metadata ? JSON.stringify(l.metadata) : "{}",
      },
    });
  }

  // Create linked Appointment for service-based order types
  if (appointmentData && orderType && APPT_ORDER_TYPES.includes(orderType)) {
    const typeLabel = APPT_TYPE_LABELS[orderType] || orderType;
    const subtypeLabel = orderType === "training" && trainingSubType
      ? TRAINING_SUBTYPE_LABELS[trainingSubType] ?? trainingSubType
      : null;
    const fullLabel = subtypeLabel ? `${typeLabel} (${subtypeLabel})` : typeLabel;
    const apptNotes = `[${fullLabel}] ${notes || ""}`.trim();
    const appt = await db.appointment.create({
      data: {
        date: new Date(appointmentData.date),
        startTime: appointmentData.startTime,
        endTime: appointmentData.endTime,
        status: "scheduled",
        serviceId: appointmentData.serviceId ?? null,
        customerId,
        petId: appointmentData.petId ?? null,
        businessId,
        notes: apptNotes || null,
      },
    });
    linkedAppointmentId = appt.id;
    await db.order.update({
      where: { id: created.id },
      data: { relatedEntityType: "Appointment", relatedEntityId: appt.id },
    });
  }

  // Auto-create TrainingProgram (+ BoardingStay if boarding subtype)
  const trainingPetId = appointmentData?.petId || petId;
  if (orderType === "training" && trainingPetId) {
    if (trainingSubType === "group" && trainingGroupId) {
      await db.trainingGroupParticipant.upsert({
        where: { trainingGroupId_dogId: { trainingGroupId, dogId: trainingPetId } },
        create: { trainingGroupId, dogId: trainingPetId, customerId, status: "ACTIVE" },
        update: { status: "ACTIVE", customerId },
      });
    } else {
      let isPkg = trainingSubType === "package";
      let resolvedPackageId: string | null = trainingPackageId || null;
      let resolvedPriceListItemId: string | null = null;
      let totalSessions: number | null = null;
      let programName = lines[0]?.name || "תוכנית אילוף";

      // Resolve sessions from PriceListItem
      const lineItemIds = lines.map((l) => l.priceListItemId).filter(Boolean) as string[];
      if (lineItemIds.length > 0) {
        const pkgItem = await db.priceListItem.findFirst({
          where: { id: { in: lineItemIds }, businessId, sessions: { gt: 0 } },
        });
        if (pkgItem) {
          isPkg = true;
          resolvedPriceListItemId = pkgItem.id;
          resolvedPackageId = null;
          totalSessions = (pkgItem as { sessions?: number | null }).sessions ?? null;
          programName = pkgItem.name;
        }
      }

      if (isPkg && resolvedPackageId) {
        const pkg = await db.trainingPackage.findFirst({ where: { id: resolvedPackageId, businessId } });
        if (pkg) {
          totalSessions = pkg.sessions ?? null;
          programName = pkg.name;
        }
      }

      if (!isPkg || (!resolvedPackageId && !resolvedPriceListItemId)) {
        const sessionLines = lines.filter((l) => l.unit === "per_session");
        if (sessionLines.length > 0) {
          totalSessions = Math.round(sessionLines.reduce((sum, l) => sum + l.quantity, 0));
        }
      }

      let boardingStayId: string | null = null;
      if (trainingSubType === "boarding" && trainingBoardingStart) {
        const stay = await db.boardingStay.create({
          data: {
            businessId,
            customerId,
            petId: trainingPetId,
            checkIn: new Date(trainingBoardingStart),
            checkOut: trainingBoardingEnd ? new Date(trainingBoardingEnd) : null,
            status: "reserved",
            roomId: null,
            notes: notes || null,
          },
        });
        boardingStayId = stay.id;
      }

      await db.trainingProgram.create({
        data: {
          businessId,
          dogId: trainingPetId,
          customerId,
          name: programName,
          programType: (programType as string) || "BASIC_OBEDIENCE",
          trainingType: trainingSubType === "boarding" ? "BOARDING" : "HOME",
          startDate: trainingSubType === "boarding" && trainingBoardingStart
            ? new Date(trainingBoardingStart)
            : appointmentData?.date ? new Date(appointmentData.date) : new Date(),
          totalSessions,
          price: calc.total || null,
          notes: notes || null,
          isPackage: isPkg,
          orderId: created.id,
          packageId: resolvedPackageId || null,
          priceListItemId: resolvedPriceListItemId || null,
          boardingStayId: boardingStayId || null,
        },
      });
    }
  }

  // Return full order with includes
  const order = await db.order.findUnique({
    where: { id: created.id },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      lines: true,
      payments: true,
      assignedTo: { select: { id: true, name: true } },
    },
  });

  return { order, linkedAppointmentId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Update order
// ─────────────────────────────────────────────────────────────────────────────

export async function updateOrder(businessId: string, db: DbClient, id: string, data: UpdateOrderData) {
  const existing = await db.order.findFirst({ where: { id, businessId } });
  if (!existing) throw new ServiceError("Order not found", "NOT_FOUND");

  const VALID_UPDATE_STATUSES = ["draft", "confirmed", "in_progress", "completed", "cancelled"];
  const VALID_UPDATE_ORDER_TYPES = ["one_time", "recurring", "package"];
  if (data.status !== undefined && !VALID_UPDATE_STATUSES.includes(data.status)) {
    throw new ServiceError("Invalid status value", "VALIDATION");
  }
  if (data.orderType !== undefined && !VALID_UPDATE_ORDER_TYPES.includes(data.orderType)) {
    throw new ServiceError("Invalid orderType value", "VALIDATION");
  }
  if (data.notes !== undefined && typeof data.notes === "string" && data.notes.length > 2000) {
    throw new ServiceError("Notes too long (max 2000 chars)", "VALIDATION");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.orderType !== undefined) updateData.orderType = data.orderType;

  const order = await db.order.update({
    where: { id, businessId },
    data: updateData,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      lines: true,
      payments: true,
    },
  });

  // Cancel pending reminders when order is cancelled (domain consistency — not a side effect)
  if (data.status === "cancelled") {
    await db.scheduledMessage.updateMany({
      where: { businessId, relatedEntityType: "ORDER", relatedEntityId: id, status: "PENDING" },
      data: { status: "CANCELED" },
    });
  }

  return order;
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete order
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteOrder(businessId: string, db: DbClient, id: string) {
  const order = await db.order.findFirst({ where: { id, businessId } });
  if (!order) throw new ServiceError("Order not found", "NOT_FOUND");
  if (!["draft", "cancelled"].includes(order.status)) {
    throw new ServiceError("Only draft or cancelled orders can be deleted", "VALIDATION");
  }

  await db.scheduledMessage.updateMany({
    where: { businessId, relatedEntityType: "ORDER", relatedEntityId: id, status: "PENDING" },
    data: { status: "CANCELED" },
  });

  await db.order.delete({ where: { id, businessId } });
}
