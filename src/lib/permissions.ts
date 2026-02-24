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
  USERS_READ: "tenant.users.read",
  USERS_WRITE: "tenant.users.write",
  CONTENT_READ: "tenant.content.read",
  CONTENT_WRITE: "tenant.content.write",
  ANALYTICS_READ: "tenant.analytics.read",
  SETTINGS_WRITE: "tenant.settings.write",
  AUDIT_READ: "tenant.audit.read",
} as const;

export type PlatformPermission = (typeof PLATFORM_PERMS)[keyof typeof PLATFORM_PERMS];
export type TenantPermission = (typeof TENANT_PERMS)[keyof typeof TENANT_PERMS];

// ─── Role → Permission Mappings ────────────────────────────────────────────────

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
    TENANT_PERMS.USERS_WRITE,
    TENANT_PERMS.CONTENT_READ,
    TENANT_PERMS.CONTENT_WRITE,
    TENANT_PERMS.ANALYTICS_READ,
    TENANT_PERMS.SETTINGS_WRITE,
    TENANT_PERMS.AUDIT_READ,
  ],
  user: [
    TENANT_PERMS.CONTENT_READ,
    TENANT_PERMS.CONTENT_WRITE,
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
const TENANT_ROLE_ORDER: TenantRole[] = ["owner", "manager", "user"];

/** Returns true if `actorRole` has equal or higher privilege than `targetRole` */
export function canModifyTenantRole(
  actorRole: TenantRole,
  targetRole: TenantRole
): boolean {
  const actorIdx = TENANT_ROLE_ORDER.indexOf(actorRole);
  const targetIdx = TENANT_ROLE_ORDER.indexOf(targetRole);
  return actorIdx !== -1 && actorIdx <= targetIdx;
}

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
