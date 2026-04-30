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

  // Trial info — trials removed, always inactive
  const trialEndsAt = null;
  const trialActive = false;
  const trialExpired = false;
  const trialDaysLeft = 0;

  // Subscription info
  const subscriptionEndsAt = user?.businessSubscriptionEndsAt ? new Date(user.businessSubscriptionEndsAt) : null;
  const subscriptionStatus = user?.businessSubscriptionStatus ?? null;
  const cancelPending = subscriptionStatus === "cancel_pending";
  const subscriptionActive = subscriptionEndsAt !== null && subscriptionEndsAt > now;
  const subscriptionExpired = subscriptionEndsAt !== null && subscriptionEndsAt <= now;
  const subscriptionDaysLeft = subscriptionActive
    ? Math.max(0, Math.ceil((subscriptionEndsAt!.getTime() - now.getTime()) / 86400000))
    : 0;

  // While auth is loading, the tier is unknown. Reporting `isFree = true` would
  // briefly lock paid features in UI before the real tier hydrates, producing a
  // visible "downgrade flash" reported by users on slow connections. Treat all
  // tier flags as `false` until we know the answer; consumers should fall back
  // to the optimistic `can()` (which already returns true while loading) and
  // the server-side route guards remain authoritative.
  const tierKnown = !loading;

  return {
    tier,
    isFree: tierKnown && tier === "free",
    isBasic: tierKnown && tier === "basic",
    isPro: tierKnown && tier === "pro",
    isGroomer: tierKnown && (tier === "groomer" || tier === ("groomer_plus" as TierKey)),
    isServiceDog: tierKnown && tier === "service_dog",
    can,
    cannot: (feature: FeatureKey) => !can(feature),
    // Trial
    trialEndsAt,
    trialActive,
    trialExpired,
    trialDaysLeft,
    // Subscription
    subscriptionEndsAt,
    subscriptionStatus,
    cancelPending,
    subscriptionActive,
    subscriptionExpired,
    subscriptionDaysLeft,
  };
}
