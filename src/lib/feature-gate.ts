/**
 * Server-side tier gate — mirrors the client's `usePlan().can()` / `TierGate`:
 * effective tier = stored tier, or "free" once the subscription lapsed
 * (same rule as getCurrentUser().businessEffectiveTier), then per-business
 * featureOverrides win over the tier default.
 */
import type { PrismaClient } from "@prisma/client";
import { hasFeatureWithOverrides, type FeatureKey } from "@/lib/feature-flags";
import { isSubscriptionLapsed } from "@/lib/subscription-access";

export interface BusinessPlanRow {
  tier: string | null;
  featureOverrides: unknown;
  subscriptionEndsAt: Date | null;
  subscriptionStatus: string | null;
  cardcomRecurringId: string | null;
}

function parseOverrides(raw: unknown): Record<string, boolean> | null {
  if (!raw) return null;
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return v && typeof v === "object" ? (v as Record<string, boolean>) : null;
  } catch {
    return null;
  }
}

/** Pure check on an already-loaded business row. */
export function planHasFeature(b: BusinessPlanRow | null, feature: FeatureKey, now: Date = new Date()): boolean {
  if (!b) return false;
  const lapsed = isSubscriptionLapsed(
    { subscriptionEndsAt: b.subscriptionEndsAt, subscriptionStatus: b.subscriptionStatus, cardcomRecurringId: b.cardcomRecurringId },
    now
  );
  const tier = lapsed ? "free" : (b.tier ?? "free");
  return hasFeatureWithOverrides(tier, feature, parseOverrides(b.featureOverrides));
}

/** Loads the business and checks the feature (businessId must come from the session). */
export async function businessHasFeature(
  db: Pick<PrismaClient, "business">,
  businessId: string,
  feature: FeatureKey
): Promise<boolean> {
  const b = await db.business.findUnique({
    where: { id: businessId },
    select: { tier: true, featureOverrides: true, subscriptionEndsAt: true, subscriptionStatus: true, cardcomRecurringId: true },
  });
  return planHasFeature(b, feature);
}
