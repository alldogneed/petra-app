/**
 * Outstanding balances ("who owes the business money") — single source of truth for
 * the MCP tool `get_outstanding_balances` and the /analytics finance section.
 *
 * Definition:
 *  - Orders in status confirmed / in_progress / completed with total > 0 whose paid payments
 *    don't cover the total → the uncovered remainder.
 *  - Pending payments → their amount, EXCEPT when linked to an order already counted above
 *    (that order's remainder already represents it — never counted twice).
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
  pendingPayments: OutstandingPendingPaymentInput[]
): OutstandingBalances {
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
  for (const o of orders) {
    const paid = o.payments.reduce((s, p) => s + p.amount, 0);
    const outstanding = o.total - paid;
    if (outstanding < 0.009) continue;
    countedOrderIds.add(o.id);
    const r = rowFor(o.customerId, o.customer?.name ?? "", o.createdAt);
    r.ordersOutstanding += outstanding;
    r.orderIds.push(o.id);
  }
  for (const p of pendingPayments) {
    if (p.orderId && countedOrderIds.has(p.orderId)) continue; // already represented by the order's outstanding amount
    const r = rowFor(p.customerId, p.customer?.name ?? "", p.createdAt);
    r.pendingAmount += p.amount;
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
  return aggregateOutstandingBalances(orders, pendingPayments);
}
