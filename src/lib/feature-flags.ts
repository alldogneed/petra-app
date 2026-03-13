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
// Columns match the Petra V2 pricing table (March 2026):
//   Free | Basic (₪99) | Groomer+ (₪169) | Pro (₪199) | Service Dog (₪229)

const FEATURE_ACCESS: Record<TierKey, Record<FeatureKey, boolean>> = {
  // ── Free ─────────────────────────────────────────────────────────────────────
  // Customers capped at 50, leads capped at 20, training programs capped at 20.
  // Basic calendar, finance, leads, and training included. Advanced features locked.
  free: {
    leads:             true,   // ✅ open, max 20 leads (FREE_LEAD_LIMIT)
    boarding:          false,
    training:          true,   // ✅ open, max 50 programs (FREE_TRAINING_LIMIT)
    training_groups:   false,
    automations:       false,
    custom_messages:   false,
    service_dogs:      false,
    groomer_portfolio: false,
    invoicing:         false,
    staff_management:  false,
    excel_export:      false,
    gcal_sync:         false,
    payments:          false,  // Payments locked — BASIC+ only
    orders:            false,  // Orders locked — BASIC+ only
    pricing:           true,   // ✅ price management (free tier only finance feature)
    pets_advanced:     false,
    scheduled_messages: false,
    whatsapp_reminders: false, // WhatsApp API reminders — PRO+ only
    online_bookings:   false,
    analytics:         false,
    intake_forms:      false,
    payment_links:     false,  // Payment request links — BASIC+ only
    webhook_leads:     false,
    appointments:      false,
  },

  // ── Basic (₪99) ──────────────────────────────────────────────────────────────
  // Unlimited customers, Google Calendar, payment links, basic WhatsApp reminders,
  // 1-on-1 training (Goals/Tasks). Unlimited leads. No boarding, no groups, no invoicing.
  basic: {
    leads:             true,   // ✅ leads unlimited (free is capped at 20)
    boarding:          false,  // Boarding rooms — PRO+ only
    training:          true,   // 1-on-1 training engine ✅
    training_groups:   false,  // Group workshops — PRO+ only
    automations:       false,  // Full automation rules — PRO+ only
    custom_messages:   false,  // Custom message templates — PRO+ only
    service_dogs:      false,  // Service dog module — SERVICE_DOG only
    groomer_portfolio: false,  // Before/after portfolio — GROOMER+ only
    invoicing:         false,  // Invoices — PRO+ only
    staff_management:  false,  // Extra staff users — PRO+ only
    excel_export:      false,  // Excel export — PRO+ only
    gcal_sync:         true,   // Google Calendar sync ✅
    payments:          true,   // Payment links ✅
    orders:            true,
    pricing:           true,
    pets_advanced:     true,
    scheduled_messages: false, // Dashboard reminders only — WhatsApp API sending requires PRO+
    whatsapp_reminders: false, // WhatsApp API reminders — PRO+ only
    online_bookings:   false,  // Online booking management — PRO+ only
    analytics:         true,
    intake_forms:      true,
    payment_links:     true,
    webhook_leads:     false,  // Make.com/API webhook for leads — PRO+ only
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
  // Full platform: CRM, boarding rooms, group training, full automations,
  // invoicing, staff, Excel. No service dog module, no groomer portfolio.
  pro: {
    leads:             true,   // CRM ✅
    boarding:          true,   // Boarding rooms ✅
    training:          true,   // Training engine ✅
    training_groups:   true,   // Group workshops ✅
    automations:       true,   // Full automations ✅
    custom_messages:   true,
    service_dogs:      false,  // Service dog — SERVICE_DOG only
    groomer_portfolio: false,  // Portfolio — GROOMER track only
    invoicing:         true,   // Invoicing ✅
    staff_management:  true,   // Staff ✅
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
export const FREE_CUSTOMER_LIMIT = 50;

/** Hard limit on lead count for the FREE tier. BASIC+ is unlimited. */
export const FREE_LEAD_LIMIT = 20;

/** Hard limit on training programs for the FREE tier. BASIC+ is unlimited. */
export const FREE_TRAINING_LIMIT = 50;

/** Hard limit on price list items for the FREE tier. BASIC+ is unlimited. */
export const FREE_PRICE_ITEM_LIMIT = 4;

/** Hard limit on open tasks for the FREE tier. BASIC+ is unlimited. */
export const FREE_TASK_LIMIT = 20;

/** Hard limit on appointments for the FREE tier. BASIC+ is unlimited. */
export const FREE_APPOINTMENT_LIMIT = 50;

// ─── Entity limits ───────────────────────────────────────────────────────────

const MAX_CUSTOMERS: Record<TierKey, number | null> = {
  free: 50,
  basic: null,
  pro: null,
  groomer: null,
  groomer_plus: null,
  service_dog: null,
};

const MAX_LEADS: Record<TierKey, number | null> = {
  free: 20,
  basic: null,
  pro: null,
  groomer: null,
  groomer_plus: null,
  service_dog: null,
};

const MAX_TRAINING_PROGRAMS: Record<TierKey, number | null> = {
  free: 50,
  basic: null,
  pro: null,
  groomer: null,
  groomer_plus: null,
  service_dog: null,
};

const MAX_PRICE_ITEMS: Record<TierKey, number | null> = {
  free: 4,
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
  pro:         "service_dog",
  groomer:     null,        // lateral track — no linear upgrade
  groomer_plus: null,
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
    free: 20, basic: null, pro: null, groomer: null, groomer_plus: null, service_dog: null,
  };
  return map[normalizeTier(tier)];
}

/** Max number of appointments for a tier. null = unlimited. */
export function getMaxAppointments(tier: string | null | undefined): number | null {
  const map: Record<TierKey, number | null> = {
    free: 50, basic: null, pro: null, groomer: null, groomer_plus: null, service_dog: null,
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
