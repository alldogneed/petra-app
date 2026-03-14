/**
 * Server-side authorization guards.
 * Import these in API routes and Server Components to enforce RBAC.
 *
 * All guards throw/return appropriate NextResponse errors — never trust the client.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionByToken, SESSION_COOKIE } from "./session";
import type { FullSession } from "./session";
import {
  hasPlatformPermission,
  hasTenantPermission,
  isPlatformAdmin,
  requires2FA,
  type PlatformPermission,
  type TenantPermission,
  type PlatformRole,
  type TenantRole,
} from "./permissions";

export { type FullSession };

// ─── Low-level helpers ─────────────────────────────────────────────────────────

/** Extract session token from cookie header */
function extractToken(request: NextRequest): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

/** Resolve the full session from a request (no authorization check yet) */
export async function resolveSession(
  request: NextRequest
): Promise<FullSession | null> {
  const token = extractToken(request);
  if (!token) return null;
  return getSessionByToken(token);
}

// ─── Platform-level guards ─────────────────────────────────────────────────────

/**
 * Require a valid session + platform role.
 * Returns { session } on success, or a NextResponse with 401/403 on failure.
 */
export async function requirePlatformRole(
  request: NextRequest,
  allowedRoles: PlatformRole[]
): Promise<{ session: FullSession } | NextResponse> {
  const session = await resolveSession(request);

  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (!session.user.isActive) {
    return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
  }

  if (!session.user.platformRole || !allowedRoles.includes(session.user.platformRole)) {
    return NextResponse.json(
      { error: "Insufficient platform permissions" },
      { status: 403 }
    );
  }

  // 2FA required for platform admins
  if (
    requires2FA(session.user.platformRole) &&
    session.user.twoFaEnabled &&
    !session.twoFaVerified
  ) {
    return NextResponse.json(
      { error: "Two-factor authentication required", code: "2FA_REQUIRED" },
      { status: 403 }
    );
  }

  return { session };
}

/**
 * Require a valid session + specific platform permission.
 */
export async function requirePlatformPermission(
  request: NextRequest,
  permission: PlatformPermission
): Promise<{ session: FullSession } | NextResponse> {
  const session = await resolveSession(request);

  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (!session.user.isActive) {
    return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
  }

  if (!hasPlatformPermission(session.user.platformRole, permission)) {
    return NextResponse.json(
      { error: "Insufficient platform permissions" },
      { status: 403 }
    );
  }

  if (
    isPlatformAdmin(session.user.platformRole) &&
    session.user.twoFaEnabled &&
    !session.twoFaVerified
  ) {
    return NextResponse.json(
      { error: "Two-factor authentication required", code: "2FA_REQUIRED" },
      { status: 403 }
    );
  }

  return { session };
}

// ─── Tenant-level guards ───────────────────────────────────────────────────────

/**
 * Require session + membership in the given business + minimum tenant role/permission.
 */
export async function requireTenantPermission(
  request: NextRequest,
  businessId: string,
  permission: TenantPermission
): Promise<{ session: FullSession; membership: { businessId: string; role: TenantRole; isActive: boolean } } | NextResponse> {
  const session = await resolveSession(request);

  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (!session.user.isActive) {
    return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
  }

  // Platform super_admin can access all tenants — log for audit trail
  if (session.user.platformRole === "super_admin") {
    console.warn(`[SECURITY] super_admin access: user=${session.user.id} (${session.user.email}) → business=${businessId} permission=${permission}`);
    logAudit({
      actorUserId: session.user.id,
      actorPlatformRole: session.user.platformRole,
      action: "SUPER_ADMIN_TENANT_ACCESS",
      targetType: "business",
      targetId: businessId,
      metadata: { permission, email: session.user.email },
    });
    const fakeMembership = { businessId, role: "owner" as TenantRole, isActive: true };
    return { session, membership: fakeMembership };
  }

  const membership = session.memberships.find(
    (m) => m.businessId === businessId && m.isActive
  );

  if (!membership) {
    return NextResponse.json(
      { error: "Not a member of this business" },
      { status: 403 }
    );
  }

  if (!hasTenantPermission(membership.role, permission)) {
    return NextResponse.json(
      { error: "Insufficient permissions for this business" },
      { status: 403 }
    );
  }

  return { session, membership };
}

// ─── Simple auth guard (session only, no business check) ──────────────────────

/**
 * Require a valid, non-expired session.
 * Does NOT check business membership — use for routes that use DEMO_BUSINESS_ID.
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ session: FullSession } | NextResponse> {
  const session = await resolveSession(request);

  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (!session.user.isActive) {
    return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
  }

  return { session };
}

// ─── Business-level guard (for tenant business routes) ────────────────────────

/**
 * Simple guard for business API routes.
 * Requires a valid session and returns the user's first active businessId.
 * Platform super_admins get a fallback businessId if they have no membership.
 */
export async function requireBusinessAuth(
  request: NextRequest
): Promise<{ session: FullSession; businessId: string } | NextResponse> {
  const session = await resolveSession(request);

  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (!session.user.isActive) {
    return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
  }

  // Impersonation: super_admin acting as a tenant
  if (session.impersonatedBusinessId) {
    const biz = await prisma.business.findUnique({
      where: { id: session.impersonatedBusinessId },
      select: { status: true },
    });
    if (biz?.status === "suspended") return NextResponse.json({ error: "business_suspended" }, { status: 403 });
    if (biz?.status === "closed") return NextResponse.json({ error: "business_closed" }, { status: 403 });
    return { session, businessId: session.impersonatedBusinessId };
  }

  // Find the first active business membership — prefer owner role so users who are
  // also employees/members of other businesses always land on their own business first.
  const membership =
    session.memberships.find((m) => m.isActive && m.role === "owner") ||
    session.memberships.find((m) => m.isActive);
  if (!membership) {
    // Platform super_admins may have no membership but need access
    if (session.user.platformRole === "super_admin") {
      // Fallback: they can pass businessId via query/header if needed
      return NextResponse.json(
        { error: "No active business membership" },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "No active business membership" },
      { status: 403 }
    );
  }

  // Check if the business is suspended/closed
  const biz = await prisma.business.findUnique({
    where: { id: membership.businessId },
    select: { status: true },
  });
  if (biz?.status === "suspended") return NextResponse.json({ error: "business_suspended" }, { status: 403 });
  if (biz?.status === "closed") return NextResponse.json({ error: "business_closed" }, { status: 403 });

  return { session, businessId: membership.businessId };
}

/** Type guard: narrows the result to a successful guard */
export function isGuardError(
  result: { session: FullSession } | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}

export function isGuardSuccess<T extends object>(
  result: T | NextResponse
): result is T {
  return !(result instanceof NextResponse);
}

// ─── IP Whitelist check ────────────────────────────────────────────────────────

import { prisma } from "./prisma";
import { logAudit } from "./audit";

/**
 * Check if the given IP is allowed for a user with an IP whitelist.
 * Returns true if no whitelist exists (unrestricted) or if IP matches.
 */
export async function checkIpWhitelist(
  userId: string,
  ip: string | null
): Promise<boolean> {
  const entries = await prisma.ipWhitelist.findMany({ where: { userId } });
  if (entries.length === 0) return true; // No restriction
  if (!ip) return false;

  return entries.some((entry) => ipMatchesCidr(ip, entry.cidr));
}

/** Simple CIDR matching for IPv4 */
function ipMatchesCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) return ip === cidr;
  const [range, bits] = cidr.split("/");
  const mask = ~(0xffffffff >>> parseInt(bits));
  const ipNum = ipToNum(ip);
  const rangeNum = ipToNum(range);
  return ipNum !== null && rangeNum !== null && (ipNum & mask) === (rangeNum & mask);
}

function ipToNum(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255))
    return null;
  return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
}
