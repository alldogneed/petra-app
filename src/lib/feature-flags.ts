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
  | "scheduled_messages"
  | "whatsapp_reminders"
  | "online_bookings"
  | "analytics"
  | "intake_forms"
  | "payment_links"
  | "webhook_leads"
  | "appointments";

// ─── Feature access matrix ────────────────────────────────────────────────────
// Public tiers (March 2026): Free | Basic (₪99) | Pro (₪199)
// Legacy tiers (DB only, no longer sold): groomer, groomer_plus, service_dog

const FEATURE_ACCESS: Record<TierKey, Record<FeatureKey, boolean>> = {
  // ── Free ─────────────────────────────────────────────────────────────────────
  // Customers capped at 50, leads capped at 20, training programs capped at 20.
  // Basic calendar, finance, leads, and training included. Advanced features locked.
  free: {
    leads:             true,   // ✅ open, max 15 leads (FREE_LEAD_LIMIT)
    boarding:          false,
    training:          true,   // ✅ open, max 10 programs (FREE_TRAINING_LIMIT)
    training_groups:   false,
    automations:       false,
    custom_messages:   false,
    service_dogs:      false,
    groomer_portfolio: false,
    invoicing:         false,
    staff_management:  false,
    excel_export:      false,
    gcal_sync:         false,
    payments:          true,   // ✅ basic payment recording — BASIC+ unlocks payment links
    orders:            true,   // ✅ open, max 15 orders (FREE_ORDER_LIMIT)
    pricing:           true,   // ✅ price management, max 8 items (FREE_PRICE_ITEM_LIMIT)
    pets_advanced:     false,
    scheduled_messages: false,
    whatsapp_reminders: false, // WhatsApp API reminders — BASIC+ only
    online_bookings:   false,
    analytics:         false,
    intake_forms:      false,
    payment_links:     false,  // Cardcom payment request links — BASIC+ only
    webhook_leads:     false,
    appointments:      true,   // ✅ open, max 20 total (FREE_APPOINTMENT_LIMIT)
  },

  // ── Basic (₪99) ──────────────────────────────────────────────────────────────
  // Single-user plan for independent groomers and trainers.
  // Unlimited customers, calendar, payments, WhatsApp reminders, before/after portfolio.
  // No team management (Pro only), no boarding, no groups.
  basic: {
    leads:             true,   // ✅ leads unlimited
    boarding:          false,  // Boarding rooms — PRO only
    training:          true,   // 1-on-1 training engine ✅
    training_groups:   false,  // Group workshops — PRO only
    automations:       false,  // Advanced automation rules — PRO only
    custom_messages:   false,  // Custom message templates — PRO only
    service_dogs:      false,  // Service dog module — enterprise only
    groomer_portfolio: true,   // ✅ Before/after portfolio — BASIC+
    invoicing:         false,  // Invoices — PRO only
    staff_management:  false,  // Single user — team management is PRO only
    excel_export:      false,  // Excel export — PRO only
    gcal_sync:         true,   // Google Calendar sync ✅
    payments:          true,   // Payment links ✅
    orders:            true,
    pricing:           true,
    pets_advanced:     true,
    scheduled_messages: true,  // ✅ WhatsApp reminders — BASIC+
    whatsapp_reminders: true,  // ✅ WhatsApp API reminders — BASIC+
    online_bookings:   true,   // ✅ Online booking page — BASIC+
    analytics:         true,
    intake_forms:      true,
    payment_links:     true,
    webhook_leads:     false,  // Make.com/API webhook for leads — PRO only
    appointments:      true,
  },

  // ── Groomer+ (₪169) ──────────────────────────────────────────────────────────
  // Groomer-specific track: portfolio, full invoicing, automations tuned for
  // groomers, staff management, Excel export, GCal. No training, no CRM, no boarding.
  groomer: {
    leads:             true,   // ✅ CRM/leads included in groomer
    boarding:          false,
    training:          false,  // Training engine not relevant for groomers
    training_groups:   false,
    automations:       true,   // WhatsApp automations (groomer-tuned) ✅
    custom_messages:   true,   // Custom templates ✅
    service_dogs:      false,
    groomer_portfolio: true,   // Before/after portfolio ✅
    invoicing:         true,   // Full invoicing ✅
    staff_management:  true,   // Staff/additional users ✅
    excel_export:      true,   // Excel export ✅
    gcal_sync:         true,   // Google Calendar ✅
    payments:          true,
    orders:            true,
    pricing:           true,
    pets_advanced:     true,
    scheduled_messages: true,  // WhatsApp reminders ✅
    whatsapp_reminders: true,  // WhatsApp API reminders ✅
    online_bookings:   true,
    analytics:         true,
    intake_forms:      true,
    payment_links:     true,
    webhook_leads:     false,  // CRM webhook not relevant for groomers
    appointments:      true,
  },

  // ── Groomer+ legacy alias (kept for DB backward-compat — same as groomer) ────
  groomer_plus: {
    leads:             true,
    boarding:          false,
    training:          false,
    training_groups:   false,
    automations:       true,
    custom_messages:   true,
    service_dogs:      false,
    groomer_portfolio: true,
    invoicing:         true,
    staff_management:  true,
    excel_export:      true,
    gcal_sync:         true,
    payments:          true,
    orders:            true,
    pricing:           true,
    pets_advanced:     true,
    scheduled_messages: true,
    whatsapp_reminders: true,
    online_bookings:   true,
    analytics:         true,
    intake_forms:      true,
    payment_links:     true,
    webhook_leads:     false,
    appointments:      true,
  },

  // ── Pro (₪199) ───────────────────────────────────────────────────────────────
  // Team & scale plan: pension management, training centers, multi-user businesses.
  // Everything in Basic + team management, boarding, groups, online bookings, invoicing.
  pro: {
    leads:             true,   // CRM ✅
    boarding:          true,   // Boarding rooms ✅
    training:          true,   // Training engine ✅
    training_groups:   true,   // Group workshops ✅
    automations:       true,   // Full automations ✅
    custom_messages:   true,
    service_dogs:      false,  // Service dog module — enterprise contact-sales only
    groomer_portfolio: true,   // ✅ Before/after portfolio (superset of Basic)
    invoicing:         true,   // Invoicing ✅
    staff_management:  true,   // ✅ Team management — PRO only
    excel_export:      true,   // Excel export ✅
    gcal_sync:         true,
    payments:          true,
    orders:            true,
    pricing:           true,
    pets_advanced:     true,
    scheduled_messages: true,
    whatsapp_reminders: true,  // WhatsApp API reminders ✅
    online_bookings:   true,
    analytics:         true,
    intake_forms:      true,
    payment_links:     true,
    webhook_leads:     true,   // API webhook for leads ✅
    appointments:      true,
  },

  // ── Service Dog (₪229) ───────────────────────────────────────────────────────
  // All PRO features + service dog module (120h tracking, placements, ID cards).
  service_dog: {
    leads:             true,
    boarding:          true,
    training:          true,
    training_groups:   true,
    automations:       true,
    custom_messages:   true,
    service_dogs:      true,   // Service dog module ✅ (exclusive to this tier)
    groomer_portfolio: false,
    invoicing:         true,
    staff_management:  true,
    excel_export:      true,
    gcal_sync:         true,
    payments:          true,
    orders:            true,
    pricing:           true,
    pets_advanced:     true,
    scheduled_messages: true,
    whatsapp_reminders: true,  // WhatsApp API reminders ✅
    online_bookings:   true,
    analytics:         true,
    intake_forms:      true,
    payment_links:     true,
    webhook_leads:     true,   // API webhook for leads ✅
    appointments:      true,
  },
};

/** Hard limit on customer count for the FREE tier. BASIC+ is unlimited. */
export const FREE_CUSTOMER_LIMIT = 30;

/** Hard limit on lead count for the FREE tier. BASIC+ is unlimited. */
export const FREE_LEAD_LIMIT = 15;

/** Hard limit on training programs for the FREE tier. BASIC+ is unlimited. */
export const FREE_TRAINING_LIMIT = 10;

/** Hard limit on price list items for the FREE tier. BASIC+ is unlimited. */
export const FREE_PRICE_ITEM_LIMIT = 8;

/** Hard limit on open tasks for the FREE tier. BASIC+ is unlimited. */
export const FREE_TASK_LIMIT = 20;

/** Hard limit on appointments (total cumulative) for the FREE tier. BASIC+ is unlimited. */
export const FREE_APPOINTMENT_LIMIT = 20;

/** Hard limit on orders (total cumulative) for the FREE tier. BASIC+ is unlimited. */
export const FREE_ORDER_LIMIT = 15;

/** Hard limit on training groups for the FREE tier. BASIC+ is unlimited. */
export const FREE_TRAINING_GROUP_LIMIT = 3;

// ─── Entity limits ───────────────────────────────────────────────────────────

const MAX_CUSTOMERS: Record<TierKey, number | null> = {
  free: FREE_CUSTOMER_LIMIT,
  basic: null,
  pro: null,
  groomer: null,
  groomer_plus: null,
  service_dog: null,
};

const MAX_LEADS: Record<TierKey, number | null> = {
  free: FREE_LEAD_LIMIT,
  basic: null,
  pro: null,
  groomer: null,
  groomer_plus: null,
  service_dog: null,
};

const MAX_TRAINING_PROGRAMS: Record<TierKey, number | null> = {
  free: FREE_TRAINING_LIMIT,
  basic: null,
  pro: null,
  groomer: null,
  groomer_plus: null,
  service_dog: null,
};

const MAX_PRICE_ITEMS: Record<TierKey, number | null> = {
  free: FREE_PRICE_ITEM_LIMIT,
  basic: null,
  pro: null,
  groomer: null,
  groomer_plus: null,
  service_dog: null,
};

const MAX_ORDERS: Record<TierKey, number | null> = {
  free: FREE_ORDER_LIMIT,
  basic: null,
  pro: null,
  groomer: null,
  groomer_plus: null,
  service_dog: null,
};

// ─── Upgrade path ─────────────────────────────────────────────────────────────

const UPGRADE_SUGGESTION: Record<TierKey, TierKey | null> = {
  free:        "basic",
  basic:       "pro",
  pro:         null,        // top public tier — contact sales for service dog
  groomer:     "pro",       // legacy tier — upgrade to Pro
  groomer_plus: "pro",      // legacy tier — upgrade to Pro
  service_dog: null,
};

const TIER_DISPLAY: Record<TierKey, { name: string; price: number }> = {
  free:        { name: "חינמי",        price: 0   },
  basic:       { name: "בייסיק",       price: 99  },
  pro:         { name: "פרו",          price: 199 },
  groomer:     { name: "גרומר+",       price: 169 },
  groomer_plus:{ name: "גרומר+",       price: 169 }, // legacy alias
  service_dog: { name: "Service Dog",  price: 229 },
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

/** Max number of leads for a tier. null = unlimited. */
export function getMaxLeads(tier: string | null | undefined): number | null {
  return MAX_LEADS[normalizeTier(tier)];
}

/** Max number of training programs for a tier. null = unlimited. */
export function getMaxTrainingPrograms(tier: string | null | undefined): number | null {
  return MAX_TRAINING_PROGRAMS[normalizeTier(tier)];
}

/** Max number of price list items for a tier. null = unlimited. */
export function getMaxPriceItems(tier: string | null | undefined): number | null {
  return MAX_PRICE_ITEMS[normalizeTier(tier)];
}

/** Max number of open tasks for a tier. null = unlimited. */
export function getMaxTasks(tier: string | null | undefined): number | null {
  const map: Record<TierKey, number | null> = {
    free: FREE_TASK_LIMIT, basic: null, pro: null, groomer: null, groomer_plus: null, service_dog: null,
  };
  return map[normalizeTier(tier)];
}

/** Max number of appointments (cumulative total) for a tier. null = unlimited. */
export function getMaxAppointments(tier: string | null | undefined): number | null {
  const map: Record<TierKey, number | null> = {
    free: FREE_APPOINTMENT_LIMIT, basic: null, pro: null, groomer: null, groomer_plus: null, service_dog: null,
  };
  return map[normalizeTier(tier)];
}

/** Max number of orders (cumulative total) for a tier. null = unlimited. */
export function getMaxOrders(tier: string | null | undefined): number | null {
  return MAX_ORDERS[normalizeTier(tier)];
}

/** Max number of training groups for a tier. null = unlimited. */
export function getMaxTrainingGroups(tier: string | null | undefined): number | null {
  const map: Record<TierKey, number | null> = {
    free: FREE_TRAINING_GROUP_LIMIT, basic: null, pro: null, groomer: null, groomer_plus: null, service_dog: null,
  };
  return map[normalizeTier(tier)];
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
