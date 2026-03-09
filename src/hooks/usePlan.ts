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
  const { user, loading } = useAuth();
  // Use effectiveTier (trial-expiry aware) when available, else fall back to stored tier
  const tier = normalizeTier(user?.businessEffectiveTier ?? user?.businessTier) as TierKey;
  const overrides: Record<string, boolean> | null =
    user?.businessFeatureOverrides ?? null;

  const can = (feature: FeatureKey): boolean => {
    // While auth is loading, grant access to prevent flash of paywall
    if (loading) return true;
    // 1. Explicit override wins
    if (overrides && feature in overrides && typeof overrides[feature] === "boolean") {
      return overrides[feature];
    }
    // 2. Fall back to tier-based access
    return hasFeature(tier, feature);
  };

  const now = new Date();

  // Trial info
  const trialEndsAt = user?.businessTrialEndsAt ? new Date(user.businessTrialEndsAt) : null;
  const trialActive = trialEndsAt !== null && trialEndsAt > now;
  const trialExpired = trialEndsAt !== null && trialEndsAt <= now;
  const trialDaysLeft = trialActive
    ? Math.max(0, Math.ceil((trialEndsAt!.getTime() - now.getTime()) / 86400000))
    : 0;

  // Subscription info
  const subscriptionEndsAt = user?.businessSubscriptionEndsAt ? new Date(user.businessSubscriptionEndsAt) : null;
  const subscriptionActive = subscriptionEndsAt !== null && subscriptionEndsAt > now;
  const subscriptionExpired = subscriptionEndsAt !== null && subscriptionEndsAt <= now;
  const subscriptionDaysLeft = subscriptionActive
    ? Math.max(0, Math.ceil((subscriptionEndsAt!.getTime() - now.getTime()) / 86400000))
    : 0;

  return {
    tier,
    isFree: tier === "free",
    isBasic: tier === "basic",
    isPro: tier === "pro",
    isGroomer: tier === "groomer" || tier === ("groomer_plus" as TierKey),
    isServiceDog: tier === "service_dog",
    can,
    cannot: (feature: FeatureKey) => !can(feature),
    // Trial
    trialEndsAt,
    trialActive,
    trialExpired,
    trialDaysLeft,
    // Subscription
    subscriptionEndsAt,
    subscriptionActive,
    subscriptionExpired,
    subscriptionDaysLeft,
  };
}
