/** DB side of `src/lib/stay-billing.ts` — billing of boarding stays, scoped to one business. */
import prisma from "@/lib/prisma";
import { computeStayBilling, type StayBilling } from "@/lib/stay-billing";

export const STAY_BILLING_MAX_IDS = 200;

export async function getStaysBilling(businessId: string, stayIds: string[]): Promise<Record<string, StayBilling>> {
  const ids = Array.from(new Set(stayIds.filter((s) => typeof s === "string" && s.length > 0))).slice(0, STAY_BILLING_MAX_IDS);
  if (ids.length === 0) return {};
  // Only stays of this business — ids from another business simply come back empty.
  const stays = await prisma.boardingStay.findMany({ where: { businessId, id: { in: ids } }, select: { id: true } });
  const ownIds = stays.map((s) => s.id);
  if (ownIds.length === 0) return {};
  const orders = await prisma.order.findMany({
    where: { businessId, relatedEntityType: "BoardingStay", relatedEntityId: { in: ownIds } },
    orderBy: { createdAt: "desc" },
    select: { id: true, total: true, status: true, relatedEntityId: true },
  });
  const orderIds = orders.map((o) => o.id);
  const payments = await prisma.payment.findMany({
    where: {
      businessId,
      OR: [{ boardingStayId: { in: ownIds } }, ...(orderIds.length ? [{ orderId: { in: orderIds } }] : [])],
    },
    select: { id: true, amount: true, status: true, orderId: true, boardingStayId: true },
  });
  return computeStayBilling(ownIds, orders, payments);
}
