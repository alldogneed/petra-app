"use client";

import { useAuth } from "@/providers/auth-provider";
import { hasFeatureWithOverrides, type TierKey } from "@/lib/feature-flags";
import { CAPABILITY_GROUPS, CRITICAL_CAPABILITIES, SERVICE_DOG_CAPABILITY_GROUPS } from "@/lib/permissions";

/**
 * The capability groups and checkboxes the owner sees in the team screens.
 * Service-dog tab permissions appear only for a business that has the module.
 */
export function useGrantableCapabilities() {
  const { user } = useAuth();
  const tier = (user?.businessEffectiveTier ?? user?.businessTier ?? "free") as TierKey;
  const hasServiceDogs = hasFeatureWithOverrides(tier, "service_dogs", user?.businessFeatureOverrides ?? null);

  const groups = CAPABILITY_GROUPS.filter((g) => hasServiceDogs || !SERVICE_DOG_CAPABILITY_GROUPS.includes(g.id));
  const capabilities = CRITICAL_CAPABILITIES.filter((c) => groups.some((g) => g.id === c.group));
  return { groups, capabilities };
}
