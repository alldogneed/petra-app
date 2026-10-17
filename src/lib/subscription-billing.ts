/**
 * Who pays what, on which card — shared by the renewal cron and the card-update flow.
 */
import prisma from "@/lib/prisma";
import { getPlanPrice } from "@/lib/cardcom-recurring";
import { cardIdentityFromEventMetadata } from "@/lib/cardcom-transactions";

/**
 * Events that record the card a business is billed on. `card_updated` (new card,
 * no charge) wins over an older activation, so the renewal cron looks for the
 * monthly charge on the card the customer actually entered last.
 */
export const BILLING_CARD_EVENTS = ["activate", "checkout_activate", "card_updated"] as const;

/**
 * Which card, and which monthly amount, does this business pay with?
 * Both come from the most recent billing-card event — the amount falls back to
 * the plan price of the tier that was actually paid for (a business can sit on
 * a higher tier granted by hand while being billed the price it agreed to).
 */
export async function billingProfile(businessId: string, currentTier: string) {
  const event = await prisma.subscriptionEvent.findFirst({
    where: { businessId, eventType: { in: [...BILLING_CARD_EVENTS] } },
    orderBy: { createdAt: "desc" },
    select: { amount: true, tier: true, metadata: true },
  });

  const paidTierRaw = (event?.metadata as Record<string, unknown> | null)?.["paidTier"];
  const paidTier = typeof paidTierRaw === "string" ? paidTierRaw : event?.tier ?? currentTier;
  const amount = event?.amount ?? getPlanPrice(paidTier)?.price ?? getPlanPrice(currentTier)?.price ?? null;

  return { identity: cardIdentityFromEventMetadata(event?.metadata), amount, paidTier };
}

/**
 * First charge of a recurring order created by a card update: the day the paid
 * period ends — but never today or earlier (the period already lapsed while the
 * old order kept failing), then tomorrow.
 */
export function cardUpdateFirstBillDate(subscriptionEndsAt: Date | null, now: Date = new Date()): Date {
  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (!subscriptionEndsAt || subscriptionEndsAt.getTime() < tomorrow.getTime()) return tomorrow;
  return subscriptionEndsAt;
}

/** The business is on a paid plan billed (or meant to be billed) by a recurring order. */
export function canUpdateCard(b: { tier: string; subscriptionStatus: string | null }): boolean {
  return b.tier !== "free" && b.subscriptionStatus === "active";
}
