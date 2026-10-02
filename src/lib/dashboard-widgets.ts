/**
 * Dashboard widget catalog + per-member layout preferences.
 *
 * Single source of truth for which widgets the dashboard has, their Hebrew
 * labels, who may see them, and how a member's saved preferences
 * (BusinessUser.dashboardPrefs) resolve into the rendered layout.
 *
 * Client-safe: no server imports.
 *
 * Preferences only HIDE / REORDER. They never reveal a widget the member's
 * permissions exclude — `requires` is checked first, and the server keeps
 * withholding the underlying numbers regardless.
 */

/** What a widget needs from usePermissions() before it can be shown at all. */
export type WidgetRequirement =
  | "finance"         // perms.canSeeFinance
  | "revenue"         // perms.canSeeRevenueSummary
  | "leads"           // !perms.isStaff
  | "activity";       // !perms.isStaff && !perms.isVolunteer

export interface DashboardBlockDef {
  id: DashboardBlockId;
  label: string;
  hint: string;
  /** "half" blocks pair up two-per-row on large screens. */
  span: "full" | "half";
  requires?: WidgetRequirement;
}

export interface DashboardStatDef {
  id: DashboardStatId;
  label: string;
  requires?: WidgetRequirement;
}

export const DASHBOARD_BLOCK_IDS = [
  "daily_focus",
  "followups_today",
  "overdue_leads",
  "top_debtors",
  "stats",
  "boarding_today",
  "revenue_chart",
  "upcoming_appointments",
  "recent_orders",
  "activity_feed",
  "tomorrow_reminders",
  "vaccinations",
  "medications",
  "birthdays",
  "at_risk",
  "open_tasks",
] as const;
export type DashboardBlockId = (typeof DASHBOARD_BLOCK_IDS)[number];

export const DASHBOARD_STAT_IDS = [
  "stat_revenue",
  "stat_active_orders",
  "stat_pending_payments",
  "stat_today_appointments",
  "stat_open_leads",
  "stat_pending_bookings",
] as const;
export type DashboardStatId = (typeof DASHBOARD_STAT_IDS)[number];

export type DashboardWidgetId = DashboardBlockId | DashboardStatId;

/** Default order = the order of this list. */
export const DASHBOARD_BLOCKS: DashboardBlockDef[] = [
  { id: "daily_focus", label: "מיקוד יומי", hint: "משימות להיום ומשימות באיחור", span: "full" },
  { id: "followups_today", label: "מעקבים להיום", hint: "לידים שמועד המעקב שלהם היום", span: "full", requires: "leads" },
  { id: "overdue_leads", label: "לידים שעבר מועד הפולואפ", hint: "לידים שלא טופלו בזמן", span: "full", requires: "leads" },
  { id: "top_debtors", label: "תשלומים פתוחים", hint: "הלקוחות עם החוב הגבוה ביותר", span: "full", requires: "finance" },
  { id: "stats", label: "כרטיסי מספרים", hint: "הכנסות, הזמנות, תורים ולידים במבט אחד", span: "full" },
  { id: "boarding_today", label: "פנסיון — כניסות ויציאות היום", hint: "מי מגיע ומי יוצא היום", span: "full" },
  { id: "revenue_chart", label: "גרף הכנסות", hint: "הכנסות 6 החודשים האחרונים מול היעד", span: "half", requires: "revenue" },
  { id: "upcoming_appointments", label: "תורים קרובים", hint: "התורים הבאים לפי סוג שירות", span: "half" },
  { id: "recent_orders", label: "הזמנות אחרונות", hint: "5 ההזמנות האחרונות", span: "half" },
  { id: "activity_feed", label: "פעילות אחרונה", hint: "מה קרה במערכת ב-24 השעות האחרונות", span: "half", requires: "activity" },
  { id: "tomorrow_reminders", label: "תזכורות למחר", hint: "תורים של מחר ושליחת תזכורת בוואטסאפ", span: "full" },
  { id: "vaccinations", label: "חיסוני כלבת", hint: "חיסונים שפג תוקפם או עומד לפוג", span: "full" },
  { id: "medications", label: "תרופות בפנסיון", hint: "תרופות לכלבים שנמצאים בפנסיון", span: "full" },
  { id: "birthdays", label: "ימי הולדת השבוע", hint: "חיות שחוגגות ב-7 הימים הקרובים", span: "full" },
  { id: "at_risk", label: "לקוחות בסיכון אי-חזרה", hint: "לקוחות שלא ביקרו 60+ יום", span: "full" },
  { id: "open_tasks", label: "משימות פתוחות", hint: "המשימות הפתוחות האחרונות", span: "full" },
];

export const DASHBOARD_STATS: DashboardStatDef[] = [
  { id: "stat_revenue", label: "הכנסות החודש", requires: "revenue" },
  { id: "stat_active_orders", label: "הזמנות פעילות", requires: "finance" },
  { id: "stat_pending_payments", label: "הזמנות לתשלום", requires: "finance" },
  { id: "stat_today_appointments", label: "תורים היום" },
  { id: "stat_open_leads", label: "לידים פתוחים", requires: "leads" },
  { id: "stat_pending_bookings", label: "תורים ממתינים לאישור" },
];

const BLOCK_SET = new Set<string>(DASHBOARD_BLOCK_IDS);
const WIDGET_SET = new Set<string>([...DASHBOARD_BLOCK_IDS, ...DASHBOARD_STAT_IDS]);

export const DASHBOARD_PREFS_VERSION = 1;

/** React Query key for GET /api/dashboard/preferences. */
export const DASHBOARD_PREFS_QUERY_KEY = ["dashboard-prefs"] as const;

export interface DashboardPrefs {
  v: number;
  hidden: DashboardWidgetId[];
  order: DashboardBlockId[];
}

/** Response of GET/PUT /api/dashboard/preferences. */
export interface DashboardPrefsResponse {
  prefs: DashboardPrefs;
  /** true = the member never saved a layout; prefs are the business-type defaults. */
  isDefault: boolean;
  businessType: string | null;
}

/**
 * Validate untrusted input (request body or stored JSON) into a clean prefs
 * object. Unknown ids, duplicates and non-strings are dropped, so the result
 * is bounded by the catalog size. Returns null when the shape is unusable.
 */
export function normalizeDashboardPrefs(input: unknown): DashboardPrefs | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.hidden) || !Array.isArray(raw.order)) return null;
  const pick = <T extends string>(list: unknown[], allowed: Set<string>): T[] => {
    const out: T[] = [];
    const seen = new Set<string>();
    for (const item of list.slice(0, 200)) {
      if (typeof item !== "string" || !allowed.has(item) || seen.has(item)) continue;
      seen.add(item);
      out.push(item as T);
    }
    return out;
  };
  return {
    v: DASHBOARD_PREFS_VERSION,
    hidden: pick<DashboardWidgetId>(raw.hidden, WIDGET_SET),
    order: pick<DashboardBlockId>(raw.order, BLOCK_SET),
  };
}

/** Business types from OnboardingProfile.businessType. */
export function defaultHiddenFor(businessType: string | null | undefined): DashboardWidgetId[] {
  switch (businessType) {
    case "מאלף כלבים":
      return ["boarding_today", "medications"];
    case "מספרה":
      return ["boarding_today", "medications", "vaccinations"];
    default:
      // "פנסיון" / "משולב" / unknown → everything
      return [];
  }
}

export function defaultDashboardPrefs(businessType?: string | null): DashboardPrefs {
  return {
    v: DASHBOARD_PREFS_VERSION,
    hidden: defaultHiddenFor(businessType),
    order: [...DASHBOARD_BLOCK_IDS],
  };
}

/**
 * Full block order: the saved order first, then every catalog block the saved
 * order doesn't know about (added after the member last saved), slotted in
 * right after its default predecessor — or at the top when it has none.
 */
export function resolveBlockOrder(saved: readonly string[]): DashboardBlockId[] {
  const result: DashboardBlockId[] = saved.filter(
    (id, i): id is DashboardBlockId => BLOCK_SET.has(id) && saved.indexOf(id) === i
  );
  DASHBOARD_BLOCK_IDS.forEach((id, defaultIndex) => {
    if (result.includes(id)) return;
    let insertAt = 0;
    for (let j = defaultIndex - 1; j >= 0; j--) {
      const idx = result.indexOf(DASHBOARD_BLOCK_IDS[j]);
      if (idx !== -1) { insertAt = idx + 1; break; }
    }
    result.splice(insertAt, 0, id);
  });
  return result;
}

export type RequirementFlags = Record<WidgetRequirement, boolean>;

export function isAllowed(def: { requires?: WidgetRequirement }, flags: RequirementFlags): boolean {
  return !def.requires || flags[def.requires];
}

const BLOCK_BY_ID = new Map(DASHBOARD_BLOCKS.map((b) => [b.id, b]));

/** Ordered list of blocks to render: allowed by permissions AND not hidden. */
export function visibleBlocks(prefs: DashboardPrefs, flags: RequirementFlags): DashboardBlockDef[] {
  const hidden = new Set<string>(prefs.hidden);
  return resolveBlockOrder(prefs.order)
    .map((id) => BLOCK_BY_ID.get(id)!)
    .filter((b) => isAllowed(b, flags) && !hidden.has(b.id));
}

/** Stat cards to render, in catalog order. */
export function visibleStats(prefs: DashboardPrefs, flags: RequirementFlags): Set<DashboardStatId> {
  const hidden = new Set<string>(prefs.hidden);
  return new Set(DASHBOARD_STATS.filter((s) => isAllowed(s, flags) && !hidden.has(s.id)).map((s) => s.id));
}

/**
 * Grid placement: consecutive "half" blocks pair up side by side; a half block
 * without a half neighbour (its partner hidden or moved away) spans the full row.
 */
export function layoutBlocks(blocks: DashboardBlockDef[]): { id: DashboardBlockId; wide: boolean }[] {
  const out: { id: DashboardBlockId; wide: boolean }[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    if (b.span === "half" && next?.span === "half") {
      out.push({ id: b.id, wide: false }, { id: next.id, wide: false });
      i++;
    } else {
      out.push({ id: b.id, wide: true });
    }
  }
  return out;
}
