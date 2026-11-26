/** DB side of `src/lib/stay-billing.ts` — billing of boarding stays, scoped to one business. */
import prisma from "@/lib/prisma";
import { computeStayBilling, type StayBilling } from "@/lib/stay-billing";
import { ServiceError } from "@/services/types";
import { createOrder, updateOrder } from "@/services/orders";
import { EXCLUDED_ORDER_STATUSES } from "@/lib/lead-deal-value";

export const STAY_BILLING_MAX_IDS = 200;

export interface StayBillingLine { name: string; quantity: number; unitPrice: number; lineTotal: number }
export type StayBillingWithLines = StayBilling & { lines: StayBillingLine[] };

export async function getStaysBilling(businessId: string, stayIds: string[]): Promise<Record<string, StayBillingWithLines>> {
  const ids = Array.from(new Set(stayIds.filter((s) => typeof s === "string" && s.length > 0))).slice(0, STAY_BILLING_MAX_IDS);
  if (ids.length === 0) return {};
  // Only stays of this business — ids from another business simply come back empty.
  const stays = await prisma.boardingStay.findMany({ where: { businessId, id: { in: ids } }, select: { id: true } });
  const ownIds = stays.map((s) => s.id);
  if (ownIds.length === 0) return {};
  const orders = await prisma.order.findMany({
    where: { businessId, relatedEntityType: "BoardingStay", relatedEntityId: { in: ownIds } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, total: true, status: true, relatedEntityId: true,
      // No orderBy on id (random uuid): rows come back in insertion order, so the stay line stays first.
      lines: { select: { name: true, quantity: true, unitPrice: true, lineTotal: true } },
    },
  });
  const orderIds = orders.map((o) => o.id);
  const payments = await prisma.payment.findMany({
    where: {
      businessId,
      OR: [{ boardingStayId: { in: ownIds } }, ...(orderIds.length ? [{ orderId: { in: orderIds } }] : [])],
    },
    select: { id: true, amount: true, status: true, orderId: true, boardingStayId: true },
  });
  const billing = computeStayBilling(ownIds, orders, payments);
  const out: Record<string, StayBillingWithLines> = {};
  for (const id of ownIds) {
    const lines = orders
      .filter((o) => o.relatedEntityId === id && !EXCLUDED_ORDER_STATUSES.includes(o.status))
      .reverse() // oldest order first → the stay line, then add-ons
      .flatMap((o) => o.lines.map((l) => ({ name: l.name, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal })));
    out[id] = { ...billing[id], lines };
  }
  return out;
}

// ─── Link an existing order / add an add-on (גבעת הכלבים 25/11/2026, א.43 + א.45) ────────────────

async function stayOfBusiness(businessId: string, stayId: string) {
  const stay = await prisma.boardingStay.findFirst({
    where: { id: stayId, businessId },
    select: { id: true, customerId: true, petId: true, checkIn: true, checkOut: true, status: true, pet: { select: { name: true } } },
  });
  if (!stay) throw new ServiceError("השהייה לא נמצאה", "NOT_FOUND");
  if (!stay.customerId) throw new ServiceError("לשהייה אין לקוח", "VALIDATION");
  return stay as typeof stay & { customerId: string };
}

/** Orders of the stay's customer that are not linked to anything and not cancelled — "קשר הזמנה קיימת". */
export async function listLinkableOrders(businessId: string, stayId: string) {
  const stay = await stayOfBusiness(businessId, stayId);
  return prisma.order.findMany({
    where: {
      businessId,
      customerId: stay.customerId,
      relatedEntityId: null,
      status: { notIn: EXCLUDED_ORDER_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, createdAt: true, total: true, status: true, orderType: true, lines: { select: { name: true }, take: 3 } },
  });
}

/** Link an order the customer already has to the stay. Same customer, not cancelled, not linked elsewhere. */
export async function linkOrderToStay(businessId: string, stayId: string, orderId: string) {
  const stay = await stayOfBusiness(businessId, stayId);
  // Conditional update = the check and the write in one statement (no $transaction — PgBouncer).
  const res = await prisma.order.updateMany({
    where: {
      id: orderId,
      businessId,
      customerId: stay.customerId,
      status: { notIn: EXCLUDED_ORDER_STATUSES },
      OR: [{ relatedEntityId: null }, { relatedEntityType: "BoardingStay", relatedEntityId: stay.id }],
    },
    data: { relatedEntityType: "BoardingStay", relatedEntityId: stay.id },
  });
  if (res.count === 0) throw new ServiceError("לא ניתן לקשר את ההזמנה הזו לשהייה (לקוח אחר, מבוטלת או מקושרת למשהו אחר)", "CONFLICT");
  return { ok: true };
}

export interface StayAddonInput {
  name: string;
  unitPrice: number;
  quantity?: number;
  priceListItemId?: string | null;
}

/**
 * Add an add-on ("תוספת חצי יום", "וטרינר") to the stay's bill. When the stay's newest order can
 * still be edited (draft / confirmed, nothing paid or pending, no invoice — the same guards as any
 * line edit) the line is appended to it; otherwise a separate add-on order linked to the stay is
 * created, so a paid or invoiced order is never rewritten. Either way it counts in the stay's balance.
 */
export async function addStayAddon(businessId: string, stayId: string, input: StayAddonInput) {
  const stay = await stayOfBusiness(businessId, stayId);
  const name = (input.name ?? "").trim().slice(0, 120);
  const quantity = input.quantity ?? 1;
  if (!name) throw new ServiceError("יש לכתוב שם לתוספת", "VALIDATION");
  if (!(typeof input.unitPrice === "number" && isFinite(input.unitPrice) && input.unitPrice >= 0 && input.unitPrice <= 100_000)) {
    throw new ServiceError("סכום לא תקין", "VALIDATION");
  }
  if (!(typeof quantity === "number" && isFinite(quantity) && quantity > 0 && quantity <= 1000)) {
    throw new ServiceError("כמות לא תקינה", "VALIDATION");
  }
  let priceListItemId: string | null = null;
  if (input.priceListItemId) {
    const item = await prisma.priceListItem.findFirst({
      where: { id: input.priceListItemId, priceList: { businessId } },
      select: { id: true },
    });
    if (!item) throw new ServiceError("פריט המחירון לא נמצא", "VALIDATION");
    priceListItemId = item.id;
  }
  const line = { name, unit: "per_unit", quantity, unitPrice: Math.round(input.unitPrice * 100) / 100, priceListItemId };

  const main = await prisma.order.findFirst({
    where: { businessId, relatedEntityType: "BoardingStay", relatedEntityId: stay.id, status: { notIn: EXCLUDED_ORDER_STATUSES } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, discountType: true, discountValue: true,
      lines: { select: { name: true, unit: true, quantity: true, unitPrice: true, taxMode: true, priceListItemId: true, metadata: true } },
    },
  });
  if (main) {
    try {
      await updateOrder(businessId, prisma, main.id, {
        lines: [
          ...main.lines.map((l) => ({
            name: l.name, unit: l.unit, quantity: l.quantity, unitPrice: l.unitPrice,
            taxMode: l.taxMode ?? undefined, priceListItemId: l.priceListItemId,
            metadata: (() => { try { return l.metadata ? JSON.parse(l.metadata) : undefined; } catch { return undefined; } })(),
          })),
          line,
        ],
        discountType: main.discountType ?? "none",
        discountValue: main.discountValue ?? 0,
      }, { allowUnpaidLineEdit: true });
      return { orderId: main.id, appended: true };
    } catch (e) {
      // Paid / invoiced / changed meanwhile → a separate add-on order below.
      if (!(e instanceof ServiceError) || e.code !== "CONFLICT") throw e;
    }
  }
  const created = await createOrder(businessId, prisma, {
    customerId: stay.customerId,
    orderType: "boarding",
    status: "confirmed",
    petId: stay.petId,
    startAt: stay.checkIn.toISOString(),
    endAt: stay.checkOut ? stay.checkOut.toISOString() : null,
    relatedEntityType: "BoardingStay",
    relatedEntityId: stay.id,
    notes: `תוספת לשהייה של ${stay.pet?.name ?? "הכלב"}`,
    lines: [line],
  });
  return { orderId: created.order?.id as string, appended: false };
}
