// Single source of truth for the settings screen: tab ids (= ?tab= values, stable —
// linked from all over the app), label message keys, groups, who sees each tab and which plan
// feature unlocks it. The lock icon in the nav and the PaywallCard both read
// `isTabLocked()`, so they can never disagree.
import type { FeatureKey } from "@/lib/feature-flags";

export type SettingsTabId =
  | "business"
  | "subscription"
  | "booking"
  | "boarding"
  | "messages"
  | "team"
  | "payments"
  | "service-dogs"
  | "integrations"
  | "ai-agents"
  | "data"
  | "security";

export type SettingsGroupId = "business" | "operations" | "communication" | "connections" | "account";

export const SETTINGS_GROUPS: { id: SettingsGroupId; labelKey: string }[] = [
  { id: "business", labelKey: "settings.settingsTabs.groups.business" },
  { id: "operations", labelKey: "settings.settingsTabs.groups.operations" },
  { id: "communication", labelKey: "settings.settingsTabs.groups.communication" },
  { id: "connections", labelKey: "settings.settingsTabs.groups.connections" },
  { id: "account", labelKey: "settings.settingsTabs.groups.account" },
];

export interface SettingsTabDef {
  id: SettingsTabId;
  /** Full message key (messages/*.json) of the tab title. */
  labelKey: string;
  group: SettingsGroupId;
  /** Full message key of the short line under the tab title. */
  descriptionKey: string;
  /** Plan feature that unlocks the tab (feature-flags.ts). */
  feature?: FeatureKey;
  /** Locked on the free plan only (no dedicated feature flag). */
  paidOnly?: boolean;
  /** Tier named on the PaywallCard. */
  requiredTier?: "basic" | "pro" | "service_dog";
  /** Full message keys of the PaywallCard title / description. */
  paywallTitleKey?: string;
  paywallDescriptionKey?: string;
  /** Who can see the tab at all. */
  visibility?: "owner" | "ownerOrManager" | "mcpAllowed" | "notGroomer";
}

export const SETTINGS_TABS: SettingsTabDef[] = [
  { id: "business", labelKey: "settings.settingsTabs.tabs.business.label", group: "business", descriptionKey: "settings.settingsTabs.tabs.business.description" },
  { id: "subscription", labelKey: "settings.settingsTabs.tabs.subscription.label", group: "business", descriptionKey: "settings.settingsTabs.tabs.subscription.description" },
  {
    id: "booking", labelKey: "settings.settingsTabs.tabs.booking.label", group: "operations", descriptionKey: "settings.settingsTabs.tabs.booking.description",
    feature: "online_bookings", requiredTier: "basic",
    paywallTitleKey: "settings.settingsTabs.tabs.booking.paywallTitle",
    paywallDescriptionKey: "settings.settingsTabs.tabs.booking.paywallDescription",
  },
  {
    id: "boarding", labelKey: "settings.settingsTabs.tabs.boarding.label", group: "operations", descriptionKey: "settings.settingsTabs.tabs.boarding.description",
    feature: "boarding", requiredTier: "pro", visibility: "notGroomer",
    paywallTitleKey: "settings.settingsTabs.tabs.boarding.paywallTitle",
    paywallDescriptionKey: "settings.settingsTabs.tabs.boarding.paywallDescription",
  },
  {
    id: "service-dogs", labelKey: "settings.settingsTabs.tabs.serviceDogs.label", group: "operations", descriptionKey: "settings.settingsTabs.tabs.serviceDogs.description",
    feature: "service_dogs", requiredTier: "service_dog", visibility: "notGroomer",
    paywallTitleKey: "settings.settingsTabs.tabs.serviceDogs.paywallTitle",
    paywallDescriptionKey: "settings.settingsTabs.tabs.serviceDogs.paywallDescription",
  },
  {
    id: "payments", labelKey: "settings.settingsTabs.tabs.payments.label", group: "operations", descriptionKey: "settings.settingsTabs.tabs.payments.description",
    feature: "contracts", requiredTier: "basic", visibility: "ownerOrManager",
    paywallTitleKey: "settings.settingsTabs.tabs.payments.paywallTitle",
    paywallDescriptionKey: "settings.settingsTabs.tabs.payments.paywallDescription",
  },
  {
    id: "messages", labelKey: "settings.settingsTabs.tabs.messages.label", group: "communication", descriptionKey: "settings.settingsTabs.tabs.messages.description",
    feature: "scheduled_messages", requiredTier: "basic",
    paywallTitleKey: "settings.settingsTabs.tabs.messages.paywallTitle",
    paywallDescriptionKey: "settings.settingsTabs.tabs.messages.paywallDescription",
  },
  {
    id: "team", labelKey: "settings.settingsTabs.tabs.team.label", group: "communication", descriptionKey: "settings.settingsTabs.tabs.team.description",
    feature: "staff_management", requiredTier: "pro", visibility: "owner",
    paywallTitleKey: "settings.settingsTabs.tabs.team.paywallTitle",
    paywallDescriptionKey: "settings.settingsTabs.tabs.team.paywallDescription",
  },
  {
    id: "integrations", labelKey: "settings.settingsTabs.tabs.integrations.label", group: "connections", descriptionKey: "settings.settingsTabs.tabs.integrations.description",
    feature: "gcal_sync", requiredTier: "basic",
    paywallTitleKey: "settings.settingsTabs.tabs.integrations.paywallTitle",
    paywallDescriptionKey: "settings.settingsTabs.tabs.integrations.paywallDescription",
  },
  {
    id: "ai-agents", labelKey: "settings.settingsTabs.tabs.aiAgents.label", group: "connections", descriptionKey: "settings.settingsTabs.tabs.aiAgents.description",
    feature: "ai_assistant", requiredTier: "pro", visibility: "mcpAllowed",
    paywallTitleKey: "settings.settingsTabs.tabs.aiAgents.paywallTitle",
    paywallDescriptionKey: "settings.settingsTabs.tabs.aiAgents.paywallDescription",
  },
  {
    id: "data", labelKey: "settings.settingsTabs.tabs.data.label", group: "connections", descriptionKey: "settings.settingsTabs.tabs.data.description",
    paidOnly: true, requiredTier: "basic",
    paywallTitleKey: "settings.settingsTabs.tabs.data.paywallTitle",
    paywallDescriptionKey: "settings.settingsTabs.tabs.data.paywallDescription",
  },
  { id: "security", labelKey: "settings.settingsTabs.tabs.security.label", group: "account", descriptionKey: "settings.settingsTabs.tabs.security.description" },
];

/** Legacy / shorthand ?tab= values that must keep working. */
const TAB_ALIASES: Record<string, SettingsTabId> = {
  ai: "ai-agents",
  contracts: "payments",
  account: "security",
  profile: "security",
  availability: "booking",
  billing: "subscription",
};

export function resolveTabParam(param: string | null | undefined): SettingsTabId | null {
  if (!param) return null;
  if (SETTINGS_TABS.some((t) => t.id === param)) return param as SettingsTabId;
  return TAB_ALIASES[param] ?? null;
}

export interface TabAccessContext {
  isOwner: boolean;
  isManager: boolean;
  isGroomer: boolean;
  mcpAllowed: boolean;
}

export function isTabVisible(tab: SettingsTabDef, ctx: TabAccessContext): boolean {
  switch (tab.visibility) {
    case "owner": return ctx.isOwner;
    case "ownerOrManager": return ctx.isOwner || ctx.isManager;
    case "mcpAllowed": return ctx.mcpAllowed;
    case "notGroomer": return !ctx.isGroomer;
    default: return true;
  }
}

export function isTabLocked(tab: SettingsTabDef, plan: { isFree: boolean; can: (f: FeatureKey) => boolean }): boolean {
  if (tab.feature) return !plan.can(tab.feature);
  if (tab.paidOnly) return plan.isFree;
  return false;
}
