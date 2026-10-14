/**
 * Outstanding balances ("who owes the business money") — single source of truth for
 * the MCP tool `get_outstanding_balances` and the /analytics finance section.
 *
 * Definition:
 *  - Orders in status confirmed / in_progress / completed with total > 0 whose paid payments
 *    don't cover the total → the uncovered remainder.
 *  - Pending payments → their amount, EXCEPT when linked to an order already counted above
 *    (that order's remainder already represents it — never counted twice).
 *  - Paid payments NOT linked to an order (recorded from the customer card / payments page
 *    without picking the order) still pay off debt:
 *      · linked to an appointment / boarding stay that an open order covers → count as paid on
 *        that order;
 *      · general (no order / appointment / stay) → customer credit, applied to the oldest open
 *        orders first, then to pending payments.
 *    Without this a customer who paid ₪1,800 three times "unlinked" still showed ₪1,800 debt.
 * Rows are per customer, sorted by total owed (desc).
 */
import type { PrismaClient } from "@prisma/client";

export const OUTSTANDING_ORDER_STATUSES = ["confirmed", "in_progress", "completed"];
/** Safety cap per query (same as the original MCP tool). */
const QUERY_CAP = 1000;

export interface OutstandingOrderInput {
  id: string;
  total: number;
  createdAt: Date;
  customerId: string;
  customer: { id: string; name: string } | null;
  payments: { amount: number }[]; // paid payments only
  /** Entity the order was created for ("Appointment" | "BoardingStay" | …). */
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

/** A PAID payment with no orderId. */
export interface OutstandingUnlinkedPaidInput {
  customerId: string;
  amount: number;
  appointmentId: string | null;
  boardingStayId: string | null;
}

export interface OutstandingPendingPaymentInput {
  id: string;
  amount: number;
  createdAt: Date;
  orderId: string | null;
  customerId: string;
  customer: { id: string; name: string } | null;
}

export interface OutstandingBalanceRow {
  /** Customer id. */
  id: string;
  name: string;
  ordersOutstanding: number;
  orderIds: string[];
  pendingAmount: number;
  pendingIds: string[];
  /** Oldest open item (order createdAt / pending payment createdAt). */
  oldest: Date;
  total: number;
}

export interface OutstandingBalances {
  rows: OutstandingBalanceRow[];
  grandTotal: number;
}

/** Pure aggregation — no DB. */
export function aggregateOutstandingBalances(
  orders: OutstandingOrderInput[],
  pendingPayments: OutstandingPendingPaymentInput[],
  unlinkedPaid: OutstandingUnlinkedPaidInput[] = []
): OutstandingBalances {
  // Unlinked paid payments: attribute to the order of their appointment / stay, else customer credit.
  const orderByEntity = new Map<string, OutstandingOrderInput>();
  for (const o of orders) {
    if (o.relatedEntityId && (o.relatedEntityType === "Appointment" || o.relatedEntityType === "BoardingStay")) {
      orderByEntity.set(`${o.relatedEntityType}:${o.relatedEntityId}`, o);
    }
  }
  const extraPaidByOrder = new Map<string, number>();
  const creditByCustomer = new Map<string, number>();
  for (const p of unlinkedPaid) {
    if (!(p.amount > 0)) continue;
    const key = p.appointmentId ? `Appointment:${p.appointmentId}` : p.boardingStayId ? `BoardingStay:${p.boardingStayId}` : null;
    if (key) {
      const o = orderByEntity.get(key);
      if (o && o.customerId === p.customerId) extraPaidByOrder.set(o.id, (extraPaidByOrder.get(o.id) ?? 0) + p.amount);
      // Paid for an appointment/stay no open order covers → not part of any debt here.
      continue;
    }
    creditByCustomer.set(p.customerId, (creditByCustomer.get(p.customerId) ?? 0) + p.amount);
  }

  type Row = Omit<OutstandingBalanceRow, "total">;
  const rows = new Map<string, Row>();
  const rowFor = (id: string, name: string, when: Date): Row => {
    let r = rows.get(id);
    if (!r) {
      r = { id, name, ordersOutstanding: 0, orderIds: [], pendingAmount: 0, pendingIds: [], oldest: when };
      rows.set(id, r);
    }
    if (when < r.oldest) r.oldest = when;
    return r;
  };

  const countedOrderIds = new Set<string>();
  // Oldest first so general customer credit pays off the oldest debt first.
  const byAge = [...orders].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const o of byAge) {
    const paid = o.payments.reduce((s, p) => s + p.amount, 0) + (extraPaidByOrder.get(o.id) ?? 0);
    let outstanding = o.total - paid;
    if (outstanding < 0.009) continue;
    const credit = creditByCustomer.get(o.customerId) ?? 0;
    if (credit > 0) {
      const used = Math.min(credit, outstanding);
      creditByCustomer.set(o.customerId, credit - used);
      outstanding -= used;
      if (outstanding < 0.009) continue;
    }
    countedOrderIds.add(o.id);
    const r = rowFor(o.customerId, o.customer?.name ?? "", o.createdAt);
    r.ordersOutstanding += outstanding;
    r.orderIds.push(o.id);
  }
  for (const p of pendingPayments) {
    if (p.orderId && countedOrderIds.has(p.orderId)) continue; // already represented by the order's outstanding amount
    let amount = p.amount;
    const credit = creditByCustomer.get(p.customerId) ?? 0;
    if (credit > 0) {
      const used = Math.min(credit, amount);
      creditByCustomer.set(p.customerId, credit - used);
      amount -= used;
    }
    if (amount < 0.009) continue;
    const r = rowFor(p.customerId, p.customer?.name ?? "", p.createdAt);
    r.pendingAmount += amount;
    r.pendingIds.push(p.id);
  }

  const all = Array.from(rows.values())
    .map((r) => ({ ...r, total: r.ordersOutstanding + r.pendingAmount }))
    .sort((a, b) => b.total - a.total);
  const grandTotal = all.reduce((s, r) => s + r.total, 0);
  return { rows: all, grandTotal };
}

/** Loads open orders + pending payments of the business and aggregates them. */
export async function computeOutstandingBalances(
  db: Pick<PrismaClient, "order" | "payment">,
  businessId: string
): Promise<OutstandingBalances> {
  const [orders, pendingPayments] = await Promise.all([
    db.order.findMany({
      where: { businessId, status: { in: OUTSTANDING_ORDER_STATUSES }, total: { gt: 0 } },
      select: {
        id: true,
        total: true,
        createdAt: true,
        customerId: true,
        customer: { select: { id: true, name: true } },
        payments: { where: { status: "paid" }, select: { amount: true } },
        relatedEntityType: true,
        relatedEntityId: true,
      },
      orderBy: { createdAt: "asc" },
      take: QUERY_CAP,
    }),
    db.payment.findMany({
      where: { businessId, status: "pending" },
      select: { id: true, amount: true, createdAt: true, orderId: true, customerId: true, customer: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
      take: QUERY_CAP,
    }),
  ]);
  const unlinkedPaid = await loadUnlinkedPaid(db, businessId, [
    ...orders.map((o) => o.customerId),
    ...pendingPayments.map((p) => p.customerId),
  ]);
  return aggregateOutstandingBalances(orders, pendingPayments, unlinkedPaid);
}

/**
 * Paid payments with no orderId, only for customers that have something open (bounded:
 * a customer with no open order / pending payment can't owe anything to offset).
 */
export async function loadUnlinkedPaid(
  db: Pick<PrismaClient, "payment">,
  businessId: string,
  customerIds: string[]
): Promise<OutstandingUnlinkedPaidInput[]> {
  const ids = Array.from(new Set(customerIds.filter((id): id is string => typeof id === "string" && id.length > 0)));
  if (ids.length === 0) return [];
  return db.payment.findMany({
    where: { businessId, status: "paid", orderId: null, customerId: { in: ids } },
    select: { customerId: true, amount: true, appointmentId: true, boardingStayId: true },
    take: QUERY_CAP * 5,
  });
}
