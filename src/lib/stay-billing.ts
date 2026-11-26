/**
 * Billing per boarding stay (דור 23/11/2026, round 2): how much the stay costs, how much
 * was paid and what is left. Pure — the DB reads live in `src/services/stay-billing.ts`.
 *
 * A stay's charge = its linked orders (`Order.relatedEntityType "BoardingStay"` +
 * `relatedEntityId`), cancelled orders excluded. A payment counts toward the stay when it is
 * linked to the stay (`Payment.boardingStayId`) OR to one of those orders (`Payment.orderId`)
 * — each payment counted once. `total` = null when no order exists yet (nothing was charged),
 * which is not the same as 0.
 */
import { EXCLUDED_ORDER_STATUSES } from "@/lib/lead-deal-value";

export interface StayBillingOrder {
  id: string;
  total: number;
  status: string;
  relatedEntityId: string | null;
}

export interface StayBillingPayment {
  id: string;
  amount: number;
  status: string;
  orderId: string | null;
  boardingStayId: string | null;
}

export interface StayBilling {
  /** Newest linked active order (the one a new payment is attached to). */
  orderId: string | null;
  orderCount: number;
  /** Σ linked active orders; null = no order yet. */
  total: number | null;
  paid: number;
  pending: number;
  /** total − paid (never below 0); null when there is no order. */
  balance: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeStayBilling(
  stayIds: string[],
  orders: StayBillingOrder[],
  payments: StayBillingPayment[]
): Record<string, StayBilling> {
  const out: Record<string, StayBilling> = {};
  const activeOrders = orders.filter((o) => !EXCLUDED_ORDER_STATUSES.includes(o.status));
  for (const stayId of stayIds) {
    const own = activeOrders.filter((o) => o.relatedEntityId === stayId);
    const orderIds = new Set(own.map((o) => o.id));
    const seen = new Set<string>();
    let paid = 0;
    let pending = 0;
    for (const p of payments) {
      if (seen.has(p.id)) continue;
      const linked = p.boardingStayId === stayId || (p.orderId != null && orderIds.has(p.orderId));
      if (!linked) continue;
      seen.add(p.id);
      if (p.status === "paid") paid += p.amount || 0;
      else if (p.status === "pending") pending += p.amount || 0;
    }
    const total = own.length ? round2(own.reduce((s, o) => s + (o.total || 0), 0)) : null;
    out[stayId] = {
      // orders arrive newest first from the service
      orderId: own[0]?.id ?? null,
      orderCount: own.length,
      total,
      paid: round2(paid),
      pending: round2(pending),
      balance: total == null ? null : Math.max(0, round2(total - paid)),
    };
  }
  return out;
}

/** Nights × price per night × dogs, the same formula as the boarding form / MCP quote. */
export function stayOrderAmount(nights: number, pricePerNight: number, dogs = 1): number {
  if (!(nights > 0) || !(pricePerNight >= 0)) return 0;
  return round2(nights * pricePerNight * Math.max(1, dogs));
}
