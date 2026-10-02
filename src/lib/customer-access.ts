/**
 * Customer-module access rules (server-side). Single place the customers routes ask
 * "may this member read / change customer files?" — overrides honoured (CLAUDE.md #34).
 *
 *  - read  = CUSTOMERS_PII (the customer file is PII: phone, address, ID number)
 *  - write = read + CONTENT_WRITE (volunteers are read-only)
 * Platform super_admin (incl. impersonation) passes, like requireBusinessPermission.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { sessionHasTenantPermission, TENANT_PERMS, type TenantPermission } from "@/lib/permissions";
import type { FullSession } from "@/lib/session";

type SessionLike = Parameters<typeof sessionHasTenantPermission>[0];

export function canReadCustomers(session: SessionLike, businessId: string): boolean {
  return sessionHasTenantPermission(session, businessId, TENANT_PERMS.CUSTOMERS_PII);
}

export function canWriteCustomers(session: SessionLike, businessId: string): boolean {
  return (
    canReadCustomers(session, businessId) &&
    sessionHasTenantPermission(session, businessId, TENANT_PERMS.CONTENT_WRITE)
  );
}

/** Convenience: any tenant permission with overrides for the caller's business. */
export function callerCan(session: SessionLike, businessId: string, perm: TenantPermission): boolean {
  return sessionHasTenantPermission(session, businessId, perm);
}

/**
 * requireBusinessAuth + customer read/write rule. Returns the guard result or a 403.
 * Usage: `const auth = await requireCustomerAccess(request, "write"); if (isGuardError(auth)) return auth;`
 */
export async function requireCustomerAccess(
  request: NextRequest,
  mode: "read" | "write"
): Promise<{ session: FullSession; businessId: string } | NextResponse> {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { session, businessId } = authResult;
  const ok = mode === "write" ? canWriteCustomers(session, businessId) : canReadCustomers(session, businessId);
  if (!ok) {
    return NextResponse.json(
      { error: mode === "write" ? "אין הרשאה לעדכן לקוחות" : "אין הרשאה לצפות בלקוחות" },
      { status: 403 }
    );
  }
  return authResult;
}
