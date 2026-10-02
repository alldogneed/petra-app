// Single source of truth for the settings screen: tab ids (= ?tab= values, stable —
// linked from all over the app), labels, groups, who sees each tab and which plan
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

export const SETTINGS_GROUPS: { id: SettingsGroupId; label: string }[] = [
  { id: "business", label: "העסק" },
  { id: "operations", label: "תפעול" },
  { id: "communication", label: "תקשורת וצוות" },
  { id: "connections", label: "חיבורים ונתונים" },
  { id: "account", label: "החשבון שלי" },
];

export interface SettingsTabDef {
  id: SettingsTabId;
  label: string;
  group: SettingsGroupId;
  /** Short line under the tab title. */
  description: string;
  /** Plan feature that unlocks the tab (feature-flags.ts). */
  feature?: FeatureKey;
  /** Locked on the free plan only (no dedicated feature flag). */
  paidOnly?: boolean;
  /** Tier named on the PaywallCard. */
  requiredTier?: "basic" | "pro" | "service_dog";
  paywallTitle?: string;
  paywallDescription?: string;
  /** Who can see the tab at all. */
  visibility?: "owner" | "ownerOrManager" | "mcpAllowed" | "notGroomer";
}

export const SETTINGS_TABS: SettingsTabDef[] = [
  { id: "business", label: "פרטי העסק", group: "business", description: "שם, פרטי קשר, לוגו וישות משפטית" },
  { id: "subscription", label: "מנוי וחיוב", group: "business", description: "המסלול שלך, שימוש ושדרוג" },
  {
    id: "booking", label: "זמינות והזמנות", group: "operations", description: "שעות פעילות, חסימות והזמנות אונליין",
    feature: "online_bookings", requiredTier: "basic",
    paywallTitle: "זמינות והזמנות אונליין",
    paywallDescription: "הגדר זמינות, שעות פעילות והזמנות אונליין — זמין במנוי בייסיק ומעלה.",
  },
  {
    id: "boarding", label: "פנסיון", group: "operations", description: "צ׳ק-אין, צ׳ק-אאוט ומינימום לילות",
    feature: "boarding", requiredTier: "pro", visibility: "notGroomer",
    paywallTitle: "הגדרות פנסיון",
    paywallDescription: "הגדר שעות צ׳ק-אין/אאוט ומינימום לילות — זמין במנוי פרו ומעלה.",
  },
  {
    id: "service-dogs", label: "כלבי שירות", group: "operations", description: "שעות אימון, הסמכה ולוח חיסונים",
    feature: "service_dogs", requiredTier: "service_dog", visibility: "notGroomer",
    paywallTitle: "הגדרות כלבי שירות",
    paywallDescription: "הגדרות תוכנית כלבי שירות — זמין במנוי Service Dog בלבד.",
  },
  {
    id: "payments", label: "חוזים", group: "operations", description: "תבניות חוזים דיגיטליים לחתימה",
    feature: "contracts", requiredTier: "basic", visibility: "ownerOrManager",
    paywallTitle: "חוזים דיגיטליים",
    paywallDescription: "תבניות חוזים וחתימה דיגיטלית — זמין במנוי בייסיק ומעלה.",
  },
  {
    id: "messages", label: "הודעות ואוטומציות", group: "communication", description: "תבניות WhatsApp ותזכורות אוטומטיות",
    feature: "scheduled_messages", requiredTier: "basic",
    paywallTitle: "הודעות ואוטומציות",
    paywallDescription: "תבניות WhatsApp, תזכורות אוטומטיות ואוטומציות — זמין במנוי בייסיק ומעלה.",
  },
  {
    id: "team", label: "צוות והרשאות", group: "communication", description: "חברי צוות, תפקידים והרשאות",
    feature: "staff_management", requiredTier: "pro", visibility: "owner",
    paywallTitle: "ניהול צוות",
    paywallDescription: "הוסף חברי צוות ונהל הרשאות — זמין במנוי פרו ומעלה.",
  },
  {
    id: "integrations", label: "אינטגרציות", group: "connections", description: "Google Calendar, WhatsApp, Make ועוד",
    feature: "gcal_sync", requiredTier: "basic",
    paywallTitle: "אינטגרציות",
    paywallDescription: "חבר יומן Google, WhatsApp ועוד — זמין במנוי בייסיק ומעלה.",
  },
  {
    id: "ai-agents", label: "עוזרי AI", group: "connections", description: "חיבור Claude, ChatGPT ועוד",
    feature: "ai_assistant", requiredTier: "pro", visibility: "mcpAllowed",
    paywallTitle: "עוזרי AI",
    paywallDescription: "חבר את העסק שלך ל-Claude, ChatGPT ועוד — זמין במנוי פרו ומעלה.",
  },
  {
    id: "data", label: "ייבוא וייצוא", group: "connections", description: "ייבוא לקוחות מאקסל וייצוא נתונים",
    paidOnly: true, requiredTier: "basic",
    paywallTitle: "ייבוא וייצוא נתונים",
    paywallDescription: "ייבוא וייצוא לקוחות ובעלי חיים ל-Excel/CSV — זמין במנוי בייסיק ומעלה.",
  },
  { id: "security", label: "פרופיל ואבטחה", group: "account", description: "השם שלך, סיסמה, אימות דו-שלבי וסשנים" },
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
