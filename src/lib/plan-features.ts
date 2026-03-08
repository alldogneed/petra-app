/**
 * plan-features.ts — backward-compatibility re-export shim.
 *
 * All logic lives in feature-flags.ts.
 * Import from feature-flags.ts directly for new code.
 */

export type { TierKey as Tier, FeatureKey } from "@/lib/feature-flags";
export {
  hasFeature,
  hasFeatureWithOverrides,
  normalizeTier,
  getTierDisplay,
  getMaxCustomers,
  getUpgradeTier,
  getPaywallConfig,
  FREE_CUSTOMER_LIMIT,
} from "@/lib/feature-flags";
