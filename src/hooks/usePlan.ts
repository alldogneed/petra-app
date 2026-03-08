"use client";

import { useAuth } from "@/providers/auth-provider";
import { hasFeature, normalizeTier, type TierKey, type FeatureKey } from "@/lib/feature-flags";

/**
 * usePlan — tier-based feature access hook.
 *
 * Reads `businessTier` + `businessFeatureOverrides` from the auth context.
 * Override logic: explicit overrides take priority over tier defaults.
 *
 * Usage:
 *   const { can, tier, isFree } = usePlan();
 *   if (!can("crm_leads")) return <PaywallCard ... />;
 */
export function usePlan() {
  const { user } = useAuth();
  const tier = normalizeTier(user?.businessTier) as TierKey;
  const overrides: Record<string, boolean> | null =
    user?.businessFeatureOverrides ?? null;

  const can = (feature: FeatureKey): boolean => {
    // 1. Explicit override wins
    if (overrides && feature in overrides && typeof overrides[feature] === "boolean") {
      return overrides[feature];
    }
    // 2. Fall back to tier-based access
    return hasFeature(tier, feature);
  };

  return {
    tier,
    isFree: tier === "free",
    isBasic: tier === "basic",
    isPro: tier === "pro",
    isGroomer: tier === "groomer" || tier === ("groomer_plus" as TierKey),
    isServiceDog: tier === "service_dog",
    can,
    cannot: (feature: FeatureKey) => !can(feature),
  };
}
