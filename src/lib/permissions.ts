/**
 * RBAC Permissions Module
 * Defines all platform and tenant permissions, role→permission mappings,
 * and server-side guard helpers.
 *
 * ALL authorization must be done server-side (API routes / Server Components).
 * Never rely on client-side role checks for security.
 */

// ─── Role Constants ────────────────────────────────────────────────────────────

/** Platform-wide roles stored in PlatformUser.platformRole */
export const PLATFORM_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  SUPPORT: "support",
} as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[keyof typeof PLATFORM_ROLES];

/** Roles within a single business (BusinessUser.role) */
export const TENANT_ROLES = {
  OWNER: "owner",
  MANAGER: "manager",
  USER: "user",
  VOLUNTEER: "volunteer",
} as const;
export type TenantRole = (typeof TENANT_ROLES)[keyof typeof TENANT_ROLES];

// ─── Permission Constants ──────────────────────────────────────────────────────

/** Platform-level permissions */
export const PLATFORM_PERMS = {
  USERS_READ: "platform.users.read",
  USERS_WRITE: "platform.users.write",
  TENANTS_READ: "platform.tenants.read",
  TENANTS_WRITE: "platform.tenants.write",
  BILLING_READ: "platform.billing.read",
  BILLING_WRITE: "platform.billing.write",
  AUDIT_READ: "platform.audit.read",
  SETTINGS_WRITE: "platform.settings.write",
} as const;

/** Tenant-level permissions */
export const TENANT_PERMS = {
  // ── Basic access ──────────────────────────────────────────────────────────
  USERS_READ:           "tenant.users.read",
  USERS_WRITE:          "tenant.users.write",
  CONTENT_READ:         "tenant.content.read",
  CONTENT_WRITE:        "tenant.content.write",
  ANALYTICS_READ:       "tenant.analytics.read",
  SETTINGS_WRITE:       "tenant.settings.write",
  AUDIT_READ:           "tenant.audit.read",

  // ── Finance ───────────────────────────────────────────────────────────────
  /** View individual payment records and amounts */
  FINANCE_READ:         "tenant.finance.read",
  /** View aggregate revenue summaries and financial analytics totals */
  FINANCE_SUMMARY:      "tenant.finance.summary",

  // ── PII — Personally Identifiable Information ─────────────────────────────
  /** View customer sensitive fields: address, ID number (ת.ז.) */
  CUSTOMERS_PII:        "tenant.customers.pii",
  /** View service-dog recipient sensitive fields: disability type, funding source */
  RECIPIENTS_SENSITIVE: "tenant.recipients.sensitive",

  // ── Destructive / Critical actions ────────────────────────────────────────
  /** Delete customers, pets, training programs (owner: double-confirm; manager: pending approval) */
  CRITICAL_DELETE:      "tenant.critical.delete",
  /** Modify business settings, pricing — critical structural changes */
  SETTINGS_CRITICAL:    "tenant.settings.critical",

  // ── Approval ──────────────────────────────────────────────────────────────
  /** Approve or reject pending manager action requests */
  APPROVE_ACTIONS:      "tenant.approve.actions",

  // ── Individually grantable capabilities (see CRITICAL_CAPABILITIES) ────────
  /** Create and edit price list items */
  PRICING_WRITE:        "tenant.pricing.write",
  /** Cancel or delete orders */
  ORDERS_CANCEL:        "tenant.orders.cancel",
  /** Record, edit and cancel payments */
  PAYMENTS_WRITE:       "tenant.payments.write",
  /** Send WhatsApp / email messages to customers */
  MESSAGES_SEND:        "tenant.messages.send",
  /** Export data (CSV / Excel / reports) */
  DATA_EXPORT:          "tenant.data.export",
  /** Use the AI assistant and mint MCP tokens */
  AI_ASSISTANT:         "tenant.ai.assistant",
  /** Manage boarding rooms, yards and occupancy */
  BOARDING_MANAGE:      "tenant.boarding.manage",
  /** Change working hours, breaks, booking blocks and booking rules */
  AVAILABILITY_MANAGE:  "tenant.availability.manage",
  /** Bulk-import customers / pets from Excel (can merge into existing customers) */
  DATA_IMPORT:          "tenant.data.import",
  /** Create, edit and delete contract templates */
  CONTRACTS_MANAGE:     "tenant.contracts.manage",
  /** Receive the business's bookings in one's own connected Google Calendar */
  CALENDAR_SYNC:        "tenant.calendar.sync",

  // ── Screens (see VIEW_SCREENS) — which modules a member sees in the menu ──
  VIEW_CUSTOMERS:       "tenant.view.customers",
  VIEW_LEADS:           "tenant.view.leads",
  VIEW_TASKS:           "tenant.view.tasks",
  VIEW_SCHEDULER:       "tenant.view.scheduler",
  VIEW_CALENDAR:        "tenant.view.calendar",
  VIEW_BOARDING:        "tenant.view.boarding",
  VIEW_SERVICE_DOGS:    "tenant.view.service_dogs",
  VIEW_TRAINING:        "tenant.view.training",
  VIEW_PETS:            "tenant.view.pets",
  VIEW_ONLINE_CLASSES:  "tenant.view.online_classes",
  VIEW_FINANCE:         "tenant.view.finance",
  VIEW_MESSAGES:        "tenant.view.messages",
} as const;

export type PlatformPermission = (typeof PLATFORM_PERMS)[keyof typeof PLATFORM_PERMS];
export type TenantPermission = (typeof TENANT_PERMS)[keyof typeof TENANT_PERMS];

// ─── Role → Permission Mappings ────────────────────────────────────────────────
//
// Permission matrix (March 2026):
//
// Permission              | Owner | Manager | Staff | Volunteer
// ─────────────────────────────────────────────────────────────
// content.read            |  ✅   |   ✅    |  ✅   |    ✅
// content.write           |  ✅   |   ✅    |  ✅   |    ❌
// analytics.read          |  ✅   |   ✅    |  ❌   |    ❌
// settings.write          |  ✅   |   ✅    |  ❌   |    ❌  (non-critical settings)
// users.read              |  ✅   |   ✅    |  ❌   |    ❌
// users.write             |  ✅   |   ❌    |  ❌   |    ❌
// audit.read              |  ✅   |   ✅    |  ❌   |    ❌
// finance.read            |  ✅   |   ✅    |  ❌   |    ❌
// finance.summary         |  ✅   |   ❌    |  ❌   |    ❌  ← owner-only
// customers.pii           |  ✅   |   ✅    |  ❌   |    ❌
// recipients.sensitive    |  ✅   |   ✅    |  ❌   |    ❌
// critical.delete         |  ✅   |   ❌    |  ❌   |    ❌  ← manager→pending approval
// settings.critical       |  ✅   |   ❌    |  ❌   |    ❌  ← manager→pending approval
// approve.actions         |  ✅   |   ❌    |  ❌   |    ❌
// availability.manage     |  ✅   |   ✅    |  ❌   |    ❌  ← owner can grant per member
// data.import             |  ✅   |   ✅    |  ❌   |    ❌
// contracts.manage        |  ✅   |   ✅    |  ❌   |    ❌
// calendar.sync           |  ✅   |   ✅    |  ✅   |    ❌
//
const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, PlatformPermission[]> = {
  super_admin: Object.values(PLATFORM_PERMS) as PlatformPermission[],
  admin: [
    PLATFORM_PERMS.USERS_READ,
    PLATFORM_PERMS.USERS_WRITE,
    PLATFORM_PERMS.TENANTS_READ,
    PLATFORM_PERMS.TENANTS_WRITE,
    PLATFORM_PERMS.BILLING_READ,
    PLATFORM_PERMS.AUDIT_READ,
    PLATFORM_PERMS.SETTINGS_WRITE,
  ],
  support: [
    PLATFORM_PERMS.USERS_READ,
    PLATFORM_PERMS.TENANTS_READ,
    PLATFORM_PERMS.AUDIT_READ,
  ],
};

/** Screens staff and volunteers see without a grant — the pre-existing sidebar behaviour. */
const STAFF_DEFAULT_SCREENS: TenantPermission[] = [
  TENANT_PERMS.VIEW_TASKS,
  TENANT_PERMS.VIEW_BOARDING,
  TENANT_PERMS.VIEW_SERVICE_DOGS,
  TENANT_PERMS.VIEW_TRAINING,
  TENANT_PERMS.VIEW_ONLINE_CLASSES,
];

const TENANT_ROLE_PERMISSIONS: Record<TenantRole, TenantPermission[]> = {
  owner: Object.values(TENANT_PERMS) as TenantPermission[],

  manager: [
    TENANT_PERMS.USERS_READ,
    // USERS_WRITE removed — only owner can add/remove team members
    TENANT_PERMS.CONTENT_READ,
    TENANT_PERMS.CONTENT_WRITE,
    TENANT_PERMS.ANALYTICS_READ,
    TENANT_PERMS.SETTINGS_WRITE,   // non-critical settings (e.g. boarding times, profile)
    TENANT_PERMS.AUDIT_READ,
    TENANT_PERMS.FINANCE_READ,     // individual payments ✅
    // FINANCE_SUMMARY removed — manager cannot see total revenue
    TENANT_PERMS.CUSTOMERS_PII,    // address + ID number ✅
    TENANT_PERMS.RECIPIENTS_SENSITIVE, // recipient disability + funding ✅
    // CRITICAL_DELETE removed — goes through pending approval
    // SETTINGS_CRITICAL removed — goes through pending approval
    // APPROVE_ACTIONS removed — owner only
    TENANT_PERMS.PRICING_WRITE,
    TENANT_PERMS.ORDERS_CANCEL,
    TENANT_PERMS.PAYMENTS_WRITE,
    TENANT_PERMS.MESSAGES_SEND,
    TENANT_PERMS.DATA_EXPORT,
    TENANT_PERMS.BOARDING_MANAGE,
    TENANT_PERMS.AVAILABILITY_MANAGE,
    TENANT_PERMS.DATA_IMPORT,
    TENANT_PERMS.CONTRACTS_MANAGE,
    TENANT_PERMS.CALENDAR_SYNC,
    // AI_ASSISTANT removed — owner grants it per member
    // Every screen — same as the sidebar showed managers before screens were grantable.
    TENANT_PERMS.VIEW_CUSTOMERS,
    TENANT_PERMS.VIEW_LEADS,
    TENANT_PERMS.VIEW_TASKS,
    TENANT_PERMS.VIEW_SCHEDULER,
    TENANT_PERMS.VIEW_CALENDAR,
    TENANT_PERMS.VIEW_BOARDING,
    TENANT_PERMS.VIEW_SERVICE_DOGS,
    TENANT_PERMS.VIEW_TRAINING,
    TENANT_PERMS.VIEW_PETS,
    TENANT_PERMS.VIEW_ONLINE_CLASSES,
    TENANT_PERMS.VIEW_FINANCE,
    TENANT_PERMS.VIEW_MESSAGES,
  ],

  // Staff (user) — day-to-day operational access, no financial or PII.
  // The capabilities below used to be enforced nowhere, so every member could
  // already use them. They stay on by default and the owner switches them off
  // per member, rather than this change silently taking work away from staff.
  user: [
    TENANT_PERMS.CONTENT_READ,
    TENANT_PERMS.CONTENT_WRITE,
    TENANT_PERMS.MESSAGES_SEND,
    TENANT_PERMS.PRICING_WRITE,
    TENANT_PERMS.ORDERS_CANCEL,
    TENANT_PERMS.PAYMENTS_WRITE,
    TENANT_PERMS.DATA_EXPORT,
    TENANT_PERMS.BOARDING_MANAGE,
    TENANT_PERMS.CALENDAR_SYNC,   // bookings already reached every connected member
    // No AVAILABILITY_MANAGE / DATA_IMPORT / CONTRACTS_MANAGE — business configuration
    // and bulk writes; the owner grants them per member.
    // No FINANCE_READ, no CUSTOMERS_PII, no RECIPIENTS_SENSITIVE
    // No AI_ASSISTANT — the owner grants it explicitly
    // Screens: exactly what the sidebar showed staff before (items without minRole).
    ...STAFF_DEFAULT_SCREENS,
  ],

  // Volunteer — read-only, no editing
  volunteer: [
    TENANT_PERMS.CONTENT_READ,
    ...STAFF_DEFAULT_SCREENS,
  ],
};

// ─── Critical capabilities the owner can toggle per team member ────────────────
//
// The role still supplies the default. An entry in BusinessUser.permissionOverrides
// wins over that default in both directions — an owner can hand a staff member the
// ability to record payments, or take message-sending away from a manager.
//
export const CAPABILITY_GROUPS = [
  { id: "screens", label: "מסכים בתפריט" },
  { id: "finance", label: "כספים" },
  { id: "customers", label: "לקוחות ונתונים" },
  { id: "operations", label: "תפעול ויומן" },
  { id: "communication", label: "תקשורת ו-AI" },
  { id: "admin", label: "ניהול העסק" },
] as const;

export type CapabilityGroupId = (typeof CAPABILITY_GROUPS)[number]["id"];

export const CRITICAL_CAPABILITIES = [
  // ── מסכים בתפריט ──
  { perms: [TENANT_PERMS.VIEW_CUSTOMERS], key: TENANT_PERMS.VIEW_CUSTOMERS, group: "screens", label: "לקוחות", hint: "רשימת הלקוחות וכרטיס לקוח. פרטים רגישים (כתובת, ת.ז.) נשארים לפי התפקיד" },
  { perms: [TENANT_PERMS.VIEW_LEADS], key: TENANT_PERMS.VIEW_LEADS, group: "screens", label: "מערכת מכירות (לידים)", hint: "לוח הלידים, שלבים ומעקב. בלי ההרשאה — גם אין גישה לנתוני הלידים" },
  { perms: [TENANT_PERMS.VIEW_TASKS], key: TENANT_PERMS.VIEW_TASKS, group: "screens", label: "ניהול משימות", hint: "מסך המשימות" },
  { perms: [TENANT_PERMS.VIEW_SCHEDULER], key: TENANT_PERMS.VIEW_SCHEDULER, group: "screens", label: "ניהול תורים אונליין", hint: "בקשות הזמנה מהאתר ואישורן" },
  { perms: [TENANT_PERMS.VIEW_CALENDAR], key: TENANT_PERMS.VIEW_CALENDAR, group: "screens", label: "יומן", hint: "יומן הפגישות של העסק" },
  { perms: [TENANT_PERMS.VIEW_BOARDING], key: TENANT_PERMS.VIEW_BOARDING, group: "screens", label: "פנסיון", hint: "מפת חדרים, שהיות ולוח האכלה" },
  { perms: [TENANT_PERMS.VIEW_SERVICE_DOGS], key: TENANT_PERMS.VIEW_SERVICE_DOGS, group: "screens", label: "כלבי שירות", hint: "כלבים, זכאים ושיבוצים" },
  { perms: [TENANT_PERMS.VIEW_TRAINING], key: TENANT_PERMS.VIEW_TRAINING, group: "screens", label: "תהליכי אילוף", hint: "תוכניות אילוף וקבוצות" },
  { perms: [TENANT_PERMS.VIEW_PETS], key: TENANT_PERMS.VIEW_PETS, group: "screens", label: "חיות מחמד", hint: "רשימת כל חיות המחמד" },
  { perms: [TENANT_PERMS.VIEW_ONLINE_CLASSES], key: TENANT_PERMS.VIEW_ONLINE_CLASSES, group: "screens", label: "שיעורים אונליין", hint: "קורסים, שיעורים ותלמידים" },
  { perms: [TENANT_PERMS.VIEW_FINANCE], key: TENANT_PERMS.VIEW_FINANCE, group: "screens", label: "פיננסים", hint: "מחירון, תשלומים וחשבוניות. סכומים נשארים לפי הרשאות הכספים" },
  { perms: [TENANT_PERMS.VIEW_MESSAGES], key: TENANT_PERMS.VIEW_MESSAGES, group: "screens", label: "הודעות", hint: "הודעות מתוזמנות ותבניות. בלי ההרשאה — גם אין גישה לנתוני ההודעות" },
  // ── כספים ──
  { perms: [TENANT_PERMS.FINANCE_SUMMARY, TENANT_PERMS.ANALYTICS_READ], key: TENANT_PERMS.FINANCE_SUMMARY, group: "finance", label: "לראות הכנסות ודוחות", hint: "סה״כ הכנסות, דוחות כספיים ומכירות מלידים" },
  { perms: [TENANT_PERMS.PAYMENTS_WRITE],  key: TENANT_PERMS.PAYMENTS_WRITE,  group: "finance", label: "לרשום ולבטל תשלומים", hint: "רישום תשלום, ביטול/החזר, קישורי תשלום וחשבוניות" },
  { perms: [TENANT_PERMS.ORDERS_CANCEL],   key: TENANT_PERMS.ORDERS_CANCEL,   group: "finance", label: "למחוק או לבטל הזמנות", hint: "ביטול ומחיקה של הזמנות" },
  { perms: [TENANT_PERMS.PRICING_WRITE],   key: TENANT_PERMS.PRICING_WRITE,   group: "finance", label: "לערוך מחירון", hint: "שירותים, מחירים ומחירונים" },
  // ── לקוחות ונתונים ──
  { perms: [TENANT_PERMS.CRITICAL_DELETE], key: TENANT_PERMS.CRITICAL_DELETE, group: "customers", label: "למחוק לקוחות וכלבים", hint: "גם מחיקת תבנית חוזה שיש לה חוזים חתומים. מנהל בלי ההרשאה — בקשה לאישור" },
  { perms: [TENANT_PERMS.DATA_EXPORT],     key: TENANT_PERMS.DATA_EXPORT,     group: "customers", label: "לייצא נתונים", hint: "ייצוא לקוחות, דוחות ויומנים ל-Excel/CSV" },
  { perms: [TENANT_PERMS.DATA_IMPORT],     key: TENANT_PERMS.DATA_IMPORT,     group: "customers", label: "לייבא לקוחות מאקסל", hint: "ייבוא המוני — יכול גם לעדכן לקוחות קיימים" },
  // ── תפעול ויומן ──
  { perms: [TENANT_PERMS.AVAILABILITY_MANAGE], key: TENANT_PERMS.AVAILABILITY_MANAGE, group: "operations", label: "לשנות שעות פעילות וזמינות", hint: "שעות פעילות, הפסקות, חסימות תאריכים, חגים וחוקי הזמנה אונליין" },
  { perms: [TENANT_PERMS.CALENDAR_SYNC],   key: TENANT_PERMS.CALENDAR_SYNC,   group: "operations", label: "לקבל את פגישות העסק ב-Google Calendar האישי", hint: "פגישות חדשות נשלחות ליומן Google שהעובד חיבר" },
  { perms: [TENANT_PERMS.BOARDING_MANAGE], key: TENANT_PERMS.BOARDING_MANAGE, group: "operations", label: "לנהל פנסיון (חדרים ותפוסה)", hint: "חדרים, חצרות ומבנה הפנסיון" },
  // ── תקשורת ו-AI ──
  { perms: [TENANT_PERMS.MESSAGES_SEND],   key: TENANT_PERMS.MESSAGES_SEND,   group: "communication", label: "לשלוח הודעות ללקוחות", hint: "WhatsApp, אימייל ותזכורות ידניות" },
  { perms: [TENANT_PERMS.AI_ASSISTANT],    key: TENANT_PERMS.AI_ASSISTANT,    group: "communication", label: "גישה לעוזר AI", hint: "חיבור Claude/ChatGPT לעסק (מנהלים בלבד)" },
  // ── ניהול העסק ──
  { perms: [TENANT_PERMS.CONTRACTS_MANAGE], key: TENANT_PERMS.CONTRACTS_MANAGE, group: "admin", label: "לנהל תבניות חוזים", hint: "העלאה, עריכה ומחיקה של תבניות. שליחת חוזה ללקוח לא דורשת הרשאה זו" },
  { perms: [TENANT_PERMS.SETTINGS_CRITICAL], key: TENANT_PERMS.SETTINGS_CRITICAL, group: "admin", label: "לשנות הגדרות עסק", hint: "פרטי העסק, לוגו, פנסיון, תזכורות, Stripe ומפתחות API" },
  { perms: [TENANT_PERMS.USERS_WRITE],     key: TENANT_PERMS.USERS_WRITE,     group: "admin", label: "לנהל צוות והרשאות", hint: "הוספת עובדים ושינוי תפקידים" },
] as const satisfies readonly { perms: readonly TenantPermission[]; key: TenantPermission; group: CapabilityGroupId; label: string; hint: string }[];

export type PermissionOverrides = Partial<Record<TenantPermission, boolean>>;

// ─── Screens: route prefix → view permission ───────────────────────────────────
//
// Single source of truth for the sidebar and the page guard (ScreenGuard). A path
// that matches no prefix is not screen-gated. Sub-screens reached from other
// modules (e.g. /orders from the dashboard) are deliberately left out.
//
export const VIEW_SCREENS: readonly { prefix: string; perm: TenantPermission }[] = [
  { prefix: "/customers",          perm: TENANT_PERMS.VIEW_CUSTOMERS },
  { prefix: "/leads",              perm: TENANT_PERMS.VIEW_LEADS },
  { prefix: "/tasks",              perm: TENANT_PERMS.VIEW_TASKS },
  { prefix: "/scheduler",          perm: TENANT_PERMS.VIEW_SCHEDULER },
  { prefix: "/calendar",           perm: TENANT_PERMS.VIEW_CALENDAR },
  { prefix: "/boarding",           perm: TENANT_PERMS.VIEW_BOARDING },
  { prefix: "/service-dogs",       perm: TENANT_PERMS.VIEW_SERVICE_DOGS },
  { prefix: "/training",           perm: TENANT_PERMS.VIEW_TRAINING },
  { prefix: "/pets",               perm: TENANT_PERMS.VIEW_PETS },
  { prefix: "/online-classes",     perm: TENANT_PERMS.VIEW_ONLINE_CLASSES },
  { prefix: "/pricing",            perm: TENANT_PERMS.VIEW_FINANCE },
  { prefix: "/price-lists",        perm: TENANT_PERMS.VIEW_FINANCE },
  { prefix: "/scheduled-messages", perm: TENANT_PERMS.VIEW_MESSAGES },
];

/** The view permission that gates `pathname`, or null when the path is not a gated screen. */
export function screenPermissionForPath(pathname: string): TenantPermission | null {
  const hit = VIEW_SCREENS.find((s) => pathname === s.prefix || pathname.startsWith(s.prefix + "/"));
  return hit?.perm ?? null;
}

/** Narrow an unknown JSON blob into a usable override map. */
export function parsePermissionOverrides(raw: unknown): PermissionOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const valid = new Set<string>(Object.values(TENANT_PERMS));
  const out: PermissionOverrides = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (valid.has(k) && typeof v === "boolean") out[k as TenantPermission] = v;
  }
  return out;
}

// ─── Permission Check Functions ────────────────────────────────────────────────

export function hasPlatformPermission(
  role: PlatformRole | null | undefined,
  permission: PlatformPermission
): boolean {
  if (!role) return false;
  return PLATFORM_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasTenantPermission(
  role: TenantRole | null | undefined,
  permission: TenantPermission,
  overrides?: PermissionOverrides | null
): boolean {
  if (!role) return false;
  // The owner is never locked out of their own business.
  if (role === TENANT_ROLES.OWNER) return true;
  const override = overrides?.[permission];
  if (typeof override === "boolean") return override;
  return TENANT_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Screens whose data APIs are permission-gated too, so the page is blocked on the role default alone. */
const API_ENFORCED_SCREENS: readonly TenantPermission[] = [TENANT_PERMS.VIEW_LEADS, TENANT_PERMS.VIEW_MESSAGES];

/**
 * Should the page at `pathname` be replaced by the "no access" screen?
 *
 * Menu visibility follows the effective permission. Direct entry is blocked only
 * when the owner explicitly unchecked the screen (or its API is enforced anyway):
 * staff reach some screens through the dashboard, search and the mobile nav
 * without a menu entry, and the role default must not take that away.
 */
export function isScreenBlocked(
  role: string | null | undefined,
  overrides: PermissionOverrides | null | undefined,
  pathname: string
): boolean {
  const perm = screenPermissionForPath(pathname);
  if (!perm || !role) return false;
  if (hasTenantPermission(role as TenantRole, perm, overrides)) return false;
  return API_ENFORCED_SCREENS.includes(perm) || overrides?.[perm] === false;
}

/**
 * Session-level check against the caller's own business, honouring the member's
 * permissionOverrides. Mirrors requireBusinessPermission (auth-guards.ts): a
 * platform super_admin (incl. impersonation) always passes. Use it after
 * requireBusinessAuth when a route needs a custom 403 message or a conditional gate.
 */
export function sessionHasTenantPermission(
  session: {
    user: { platformRole?: string | null };
    memberships: { businessId: string; role: string; permissionOverrides?: PermissionOverrides | null; isActive: boolean }[];
  },
  businessId: string,
  permission: TenantPermission
): boolean {
  if (session.user.platformRole === PLATFORM_ROLES.SUPER_ADMIN) return true;
  const m = session.memberships.find((x) => x.businessId === businessId && x.isActive);
  return hasTenantPermission((m?.role ?? "user") as TenantRole, permission, m?.permissionOverrides);
}

/** Returns true if the role is a platform admin (requires 2FA) */
export function isPlatformAdmin(role: string | null | undefined): boolean {
  return role === PLATFORM_ROLES.SUPER_ADMIN || role === PLATFORM_ROLES.ADMIN;
}

/** Returns true if the role requires 2FA */
export function requires2FA(role: string | null | undefined): boolean {
  return isPlatformAdmin(role);
}

/** Ordered list of tenant roles from highest to lowest privilege */
const TENANT_ROLE_ORDER: TenantRole[] = ["owner", "manager", "user", "volunteer"];

/** Returns true if `actorRole` has equal or higher privilege than `targetRole` */
export function canModifyTenantRole(
  actorRole: TenantRole,
  targetRole: TenantRole
): boolean {
  const actorIdx = TENANT_ROLE_ORDER.indexOf(actorRole);
  const targetIdx = TENANT_ROLE_ORDER.indexOf(targetRole);
  return actorIdx !== -1 && actorIdx <= targetIdx;
}

/**
 * Returns the set of fine-grained booleans for client-side use.
 * Pass the role string from the session membership.
 * Security note: this is for UI display only — always enforce on the server.
 */
export function getClientPermissions(
  role: string | null | undefined,
  overrides?: PermissionOverrides | null
) {
  const r = (role ?? "user") as TenantRole;
  const can = (p: TenantPermission) => hasTenantPermission(r, p, overrides);
  return {
    canSeeFinance:          can(TENANT_PERMS.FINANCE_READ),
    canSeeRevenueSummary:   can(TENANT_PERMS.FINANCE_SUMMARY),
    canSeePii:              can(TENANT_PERMS.CUSTOMERS_PII),
    canWriteCustomers:      can(TENANT_PERMS.CUSTOMERS_PII) && can(TENANT_PERMS.CONTENT_WRITE),
    canSeeRecipientsSensitive: can(TENANT_PERMS.RECIPIENTS_SENSITIVE),
    canCriticalDelete:      can(TENANT_PERMS.CRITICAL_DELETE),
    canCriticalSettings:    can(TENANT_PERMS.SETTINGS_CRITICAL),
    canApproveActions:      can(TENANT_PERMS.APPROVE_ACTIONS),
    canManageTeam:          can(TENANT_PERMS.USERS_WRITE),
    canViewTeam:            can(TENANT_PERMS.USERS_READ),
    canViewAnalytics:       can(TENANT_PERMS.ANALYTICS_READ),
    canViewAudit:           can(TENANT_PERMS.AUDIT_READ),
    canEditPricing:         can(TENANT_PERMS.PRICING_WRITE),
    canCancelOrders:        can(TENANT_PERMS.ORDERS_CANCEL),
    canWritePayments:       can(TENANT_PERMS.PAYMENTS_WRITE),
    canSendMessages:        can(TENANT_PERMS.MESSAGES_SEND),
    canExportData:          can(TENANT_PERMS.DATA_EXPORT),
    canUseAiAssistant:      can(TENANT_PERMS.AI_ASSISTANT),
    canManageBoarding:      can(TENANT_PERMS.BOARDING_MANAGE),
    canManageAvailability:  can(TENANT_PERMS.AVAILABILITY_MANAGE),
    canImportData:          can(TENANT_PERMS.DATA_IMPORT),
    canManageContracts:     can(TENANT_PERMS.CONTRACTS_MANAGE),
    canSyncCalendar:        can(TENANT_PERMS.CALENDAR_SYNC),
    canViewCustomers:       can(TENANT_PERMS.VIEW_CUSTOMERS),
    canViewLeads:           can(TENANT_PERMS.VIEW_LEADS),
    canViewTasks:           can(TENANT_PERMS.VIEW_TASKS),
    canViewScheduler:       can(TENANT_PERMS.VIEW_SCHEDULER),
    canViewCalendar:        can(TENANT_PERMS.VIEW_CALENDAR),
    canViewBoarding:        can(TENANT_PERMS.VIEW_BOARDING),
    canViewServiceDogs:     can(TENANT_PERMS.VIEW_SERVICE_DOGS),
    canViewTraining:        can(TENANT_PERMS.VIEW_TRAINING),
    canViewPets:            can(TENANT_PERMS.VIEW_PETS),
    canViewOnlineClasses:   can(TENANT_PERMS.VIEW_ONLINE_CLASSES),
    canViewFinanceScreen:   can(TENANT_PERMS.VIEW_FINANCE),
    canViewMessages:        can(TENANT_PERMS.VIEW_MESSAGES),
    isOwner:                r === "owner",
    isManager:              r === "manager",
    isStaff:                r === "user",
    isVolunteer:            r === "volunteer",
    role:                   r,
  };
}

export type ClientPermissions = ReturnType<typeof getClientPermissions>;

// ─── Session-based user shape ──────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string; // "USER" | "MASTER"
  platformRole: PlatformRole | null;
  twoFaEnabled: boolean;
  twoFaVerified: boolean;
  isActive: boolean;
}

export interface SessionMembership {
  businessId: string;
  role: TenantRole;
  permissionOverrides?: PermissionOverrides | null;
  isActive: boolean;
}

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

// Re-export FullSession from session.ts so existing imports continue to work
export type { FullSession } from "./session";
