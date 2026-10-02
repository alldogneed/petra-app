/**
 * Per-customer balance ("how much does this customer owe") — server-side only.
 *
 * Same definition as `computeOutstandingBalances` (src/lib/outstanding-balances.ts) so the
 * customers list, the customer card, /analytics and MCP `get_outstanding_balances` agree:
 *  - open orders (confirmed / in_progress / completed, total > 0) → total minus PAID payments
 *  - pending payments → their amount, unless linked to an order already counted above
 * Plus `totalPaid` = Σ paid payments of the customer (all time, not a capped window).
 */
import type { PrismaClient } from "@prisma/client";
import { aggregateOutstandingBalances, OUTSTANDING_ORDER_STATUSES } from "@/lib/outstanding-balances";

export interface CustomerBalance {
  /** Total owed = ordersOutstanding + pendingAmount. */
  outstanding: number;
  ordersOutstanding: number;
  pendingAmount: number;
  totalPaid: number;
}

export const ZERO_BALANCE: CustomerBalance = { outstanding: 0, ordersOutstanding: 0, pendingAmount: 0, totalPaid: 0 };

/** Safety cap when scanning a whole business (debt filter / balance sort). */
const BUSINESS_SCAN_CAP = 20_000;

type Db = Pick<PrismaClient, "order" | "payment">;

/**
 * Balances keyed by customer id. `customerIds` = only these customers (≤ a page);
 * `null` = every customer of the business that owes anything (for filters / sorting).
 * Customers that owe nothing and paid nothing are absent from the map (= ZERO_BALANCE).
 */
export async function computeCustomerBalances(
  db: Db,
  businessId: string,
  customerIds: string[] | null
): Promise<Map<string, CustomerBalance>> {
  if (customerIds && customerIds.length === 0) return new Map();
  const customerFilter = customerIds ? { customerId: { in: customerIds } } : {};

  const [orders, pendingPayments, paidSums] = await Promise.all([
    db.order.findMany({
      where: { businessId, ...customerFilter, status: { in: OUTSTANDING_ORDER_STATUSES }, total: { gt: 0 } },
      select: {
        id: true,
        total: true,
        createdAt: true,
        customerId: true,
        payments: { where: { status: "paid" }, select: { amount: true } },
      },
      take: BUSINESS_SCAN_CAP,
    }),
    db.payment.findMany({
      where: { businessId, ...customerFilter, status: "pending" },
      select: { id: true, amount: true, createdAt: true, orderId: true, customerId: true },
      take: BUSINESS_SCAN_CAP,
    }),
    customerIds
      ? db.payment.groupBy({
          by: ["customerId"],
          where: { businessId, customerId: { in: customerIds }, status: "paid" },
          _sum: { amount: true },
        })
      : Promise.resolve([] as { customerId: string; _sum: { amount: number | null } }[]),
  ]);

  const agg = aggregateOutstandingBalances(
    orders.map((o) => ({ ...o, customer: null })),
    pendingPayments.map((p) => ({ ...p, customer: null }))
  );

  const out = new Map<string, CustomerBalance>();
  for (const r of agg.rows) {
    out.set(r.id, {
      outstanding: round2(r.total),
      ordersOutstanding: round2(r.ordersOutstanding),
      pendingAmount: round2(r.pendingAmount),
      totalPaid: 0,
    });
  }
  for (const s of paidSums) {
    const paid = round2(s._sum.amount ?? 0);
    const cur = out.get(s.customerId);
    if (cur) cur.totalPaid = paid;
    else out.set(s.customerId, { ...ZERO_BALANCE, totalPaid: paid });
  }
  return out;
}

/** Balance of a single customer (customer card). */
export async function computeCustomerBalance(db: Db, businessId: string, customerId: string): Promise<CustomerBalance> {
  const m = await computeCustomerBalances(db, businessId, [customerId]);
  return m.get(customerId) ?? { ...ZERO_BALANCE };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
