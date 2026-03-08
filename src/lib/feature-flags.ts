/**
 * feature-flags.ts — Tier-based feature access control for Petra.
 *
 * Pure functions only — no React, no hooks.
 * Import this in both server and client code.
 */

export type TierKey =
  | "free"
  | "basic"
  | "pro"
  | "groomer"
  | "groomer_plus"
  | "service_dog";

export type FeatureKey =
  | "leads"
  | "boarding"
  | "training"
  | "training_groups"
  | "automations"
  | "custom_messages"
  | "service_dogs"
  | "groomer_portfolio"
  | "invoicing"
  | "staff_management"
  | "excel_export"
  | "gcal_sync"
  | "payments"
  | "orders"
  | "pricing"
  | "pets_advanced"
  | "scheduled_messages";

// ─── Feature access matrix ────────────────────────────────────────────────────

const FEATURE_ACCESS: Record<TierKey, Record<FeatureKey, boolean>> = {
  free: {
    leads: false,
    boarding: false,
    training: false,
    training_groups: false,
    automations: false,
    custom_messages: false,
    service_dogs: false,
    groomer_portfolio: false,
    invoicing: false,
    staff_management: false,
    excel_export: false,
    gcal_sync: false,
    payments: false,
    orders: false,
    pricing: false,
    pets_advanced: false,
    scheduled_messages: false,
  },
  basic: {
    leads: false,             // CRM locked — PRO+
    boarding: false,          // Boarding locked — PRO+
    training: true,           // 1-on-1 training UNLOCKED for BASIC
    training_groups: false,   // Group workshops locked — PRO+
    automations: false,       // Automations locked — PRO+
    custom_messages: false,   // Advanced custom messages locked — PRO+
    service_dogs: false,      // Service dog module locked — SERVICE_DOG only
    groomer_portfolio: false, // Groomer portfolio locked — GROOMER track only
    invoicing: false,         // Full invoicing locked — PRO+
    staff_management: false,  // Staff management locked — PRO+
    excel_export: false,      // Excel export locked — PRO+
    gcal_sync: true,          // Google Calendar sync UNLOCKED for BASIC
    payments: true,           // Simple payments UNLOCKED for BASIC
    orders: true,             // Orders UNLOCKED for BASIC
    pricing: true,            // Pricing/products UNLOCKED for BASIC
    pets_advanced: true,      // Advanced pet features UNLOCKED for BASIC
    scheduled_messages: true, // WhatsApp appointment reminders UNLOCKED for BASIC
  },
  pro: {
    leads: true,
    boarding: true,
    training: true,
    training_groups: true,
    automations: true,
    custom_messages: true,
    service_dogs: false,
    groomer_portfolio: false,
    invoicing: true,
    staff_management: true,
    excel_export: true,
    gcal_sync: true,
    payments: true,
    orders: true,
    pricing: true,
    pets_advanced: true,
    scheduled_messages: true,
  },
  groomer: {
    leads: true,
    boarding: false,
    training: false,
    training_groups: false,
    automations: false,
    custom_messages: false,
    service_dogs: false,
    groomer_portfolio: true,
    invoicing: true,
    staff_management: false,
    excel_export: false,
    gcal_sync: false,
    payments: true,
    orders: true,
    pricing: true,
    pets_advanced: true,
    scheduled_messages: false,
  },
  groomer_plus: {
    leads: false,
    boarding: false,
    training: false,
    training_groups: false,
    automations: false,
    custom_messages: false,
    service_dogs: false,
    groomer_portfolio: true,
    invoicing: true,
    staff_management: true,
    excel_export: true,
    gcal_sync: true,
    payments: true,
    orders: true,
    pricing: true,
    pets_advanced: true,
    scheduled_messages: false,
  },
  service_dog: {
    leads: true,
    boarding: true,
    training: true,
    training_groups: true,
    automations: true,
    custom_messages: true,
    service_dogs: true,
    groomer_portfolio: false,
    invoicing: true,
    staff_management: true,
    excel_export: true,
    gcal_sync: true,
    payments: true,
    orders: true,
    pricing: true,
    pets_advanced: true,
    scheduled_messages: true,
  },
};

/** Hard limit on customer count for the FREE tier. BASIC+ is unlimited. */
export const FREE_CUSTOMER_LIMIT = 15;

// ─── Customer limits ──────────────────────────────────────────────────────────

const MAX_CUSTOMERS: Record<TierKey, number | null> = {
  free: 15,
  basic: null,
  pro: null,
  groomer: null,
  groomer_plus: null,
  service_dog: null,
};

// ─── Upgrade path ─────────────────────────────────────────────────────────────

const UPGRADE_SUGGESTION: Record<TierKey, TierKey | null> = {
  free: "basic",
  basic: "pro",
  pro: "service_dog",
  groomer: "groomer_plus",
  groomer_plus: "pro",
  service_dog: null,
};

const TIER_DISPLAY: Record<TierKey, { name: string; price: number }> = {
  free: { name: "חינמי", price: 0 },
  basic: { name: "בייסיק", price: 99 },
  pro: { name: "פרו", price: 199 },
  groomer: { name: "גרומר", price: 169 },
  groomer_plus: { name: "גרומר+", price: 229 },
  service_dog: { name: "Service Dog", price: 299 },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/** Is the given tier string a valid TierKey? */
export function isValidTier(tier: string | null | undefined): tier is TierKey {
  return !!tier && tier in FEATURE_ACCESS;
}

/** Normalise any string to a TierKey, defaulting to "free". */
export function normalizeTier(tier: string | null | undefined): TierKey {
  return isValidTier(tier) ? tier : "free";
}

/** Does the given tier have access to a feature? */
export function hasFeature(tier: string | null | undefined, feature: FeatureKey): boolean {
  const t = normalizeTier(tier);
  return FEATURE_ACCESS[t][feature];
}

/**
 * Check feature access with per-tenant override support.
 * Priority: explicit override > tier default.
 * Used by API routes when a business has feature_overrides set.
 */
export function hasFeatureWithOverrides(
  tier: string | null | undefined,
  feature: FeatureKey,
  overrides?: Record<string, boolean> | null
): boolean {
  if (overrides && feature in overrides && typeof overrides[feature] === "boolean") {
    return overrides[feature];
  }
  return hasFeature(tier, feature);
}

/** Max number of customers for a tier. null = unlimited. */
export function getMaxCustomers(tier: string | null | undefined): number | null {
  return MAX_CUSTOMERS[normalizeTier(tier)];
}

/** The tier to suggest upgrading to when a feature is locked. */
export function getUpgradeTier(tier: string | null | undefined): TierKey | null {
  return UPGRADE_SUGGESTION[normalizeTier(tier)];
}

/** Display name + price for a tier. */
export function getTierDisplay(tier: string | null | undefined) {
  return TIER_DISPLAY[normalizeTier(tier)];
}

/**
 * Full config for a paywall block.
 * - `locked`: whether this tier lacks the feature
 * - `upgradeTo`: the suggested next tier
 * - `upgradeDisplay`: display info for the upgrade target
 */
export function getPaywallConfig(tier: string | null | undefined, feature: FeatureKey) {
  const t = normalizeTier(tier);
  const locked = !hasFeature(t, feature);
  const upgradeTo = getUpgradeTier(t);
  return {
    locked,
    currentTier: t,
    upgradeTo,
    upgradeDisplay: upgradeTo ? getTierDisplay(upgradeTo) : null,
  };
}
