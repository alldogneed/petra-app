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
  ],

  // Staff (user) — day-to-day operational access, no financial or PII
  user: [
    TENANT_PERMS.CONTENT_READ,
    TENANT_PERMS.CONTENT_WRITE,
    // No FINANCE_READ, no CUSTOMERS_PII, no RECIPIENTS_SENSITIVE
  ],

  // Volunteer — read-only, no editing
  volunteer: [
    TENANT_PERMS.CONTENT_READ,
  ],
};

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
  permission: TenantPermission
): boolean {
  if (!role) return false;
  return TENANT_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
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
export function getClientPermissions(role: string | null | undefined) {
  const r = (role ?? "user") as TenantRole;
  return {
    canSeeFinance:          hasTenantPermission(r, TENANT_PERMS.FINANCE_READ),
    canSeeRevenueSummary:   hasTenantPermission(r, TENANT_PERMS.FINANCE_SUMMARY),
    canSeePii:              hasTenantPermission(r, TENANT_PERMS.CUSTOMERS_PII),
    canSeeRecipientsSensitive: hasTenantPermission(r, TENANT_PERMS.RECIPIENTS_SENSITIVE),
    canCriticalDelete:      hasTenantPermission(r, TENANT_PERMS.CRITICAL_DELETE),
    canCriticalSettings:    hasTenantPermission(r, TENANT_PERMS.SETTINGS_CRITICAL),
    canApproveActions:      hasTenantPermission(r, TENANT_PERMS.APPROVE_ACTIONS),
    canManageTeam:          hasTenantPermission(r, TENANT_PERMS.USERS_WRITE),
    canViewTeam:            hasTenantPermission(r, TENANT_PERMS.USERS_READ),
    canViewAnalytics:       hasTenantPermission(r, TENANT_PERMS.ANALYTICS_READ),
    canViewAudit:           hasTenantPermission(r, TENANT_PERMS.AUDIT_READ),
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
  isActive: boolean;
}

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

// Re-export FullSession from session.ts so existing imports continue to work
export type { FullSession } from "./session";
