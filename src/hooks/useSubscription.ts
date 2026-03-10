"use client";

import { useAuth } from "@/providers/auth-provider";
import {
  hasFeature,
  getMaxCustomers,
  getMaxLeads,
  getMaxTrainingPrograms,
  getUpgradeTier,
  getTierDisplay,
  normalizeTier,
  type FeatureKey,
} from "@/lib/feature-flags";

export function useSubscription() {
  const { user } = useAuth();
  const tier = normalizeTier(user?.businessTier);
  const overrides = user?.businessFeatureOverrides ?? null;

  return {
    tier,
    tierDisplay: getTierDisplay(tier),
    hasFeature: (feature: FeatureKey) => {
      // Per-tenant overrides win over tier defaults
      if (overrides && feature in overrides) return overrides[feature as string] as boolean;
      return hasFeature(tier, feature);
    },
    maxCustomers: getMaxCustomers(tier),
    maxLeads: getMaxLeads(tier),
    maxTrainingPrograms: getMaxTrainingPrograms(tier),
    upgradeTier: getUpgradeTier(tier),
  };
}
