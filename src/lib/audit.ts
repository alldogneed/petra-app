/**
 * Audit log helper.
 * Call logAudit() from any privileged API route to create an immutable audit trail.
 */

import { prisma } from "./prisma";
import type { NextRequest } from "next/server";

export const AUDIT_ACTIONS = {
  // Auth
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILURE: "LOGIN_FAILURE",
  LOGOUT: "LOGOUT",
  TWO_FA_ENROLLED: "TWO_FA_ENROLLED",
  TWO_FA_VERIFIED: "TWO_FA_VERIFIED",
  TWO_FA_FAILED: "TWO_FA_FAILED",

  // Platform: users
  PLATFORM_USER_CREATED: "PLATFORM_USER_CREATED",
  PLATFORM_USER_DELETED: "PLATFORM_USER_DELETED",
  PLATFORM_USER_BLOCKED: "PLATFORM_USER_BLOCKED",
  PLATFORM_USER_UNBLOCKED: "PLATFORM_USER_UNBLOCKED",
  PLATFORM_ROLE_CHANGED: "PLATFORM_ROLE_CHANGED",
  USER_ONBOARDED: "USER_ONBOARDED",

  // Platform: tenants
  TENANT_CREATED: "TENANT_CREATED",
  TENANT_SUSPENDED: "TENANT_SUSPENDED",
  TENANT_ACTIVATED: "TENANT_ACTIVATED",
  TENANT_CLOSED: "TENANT_CLOSED",

  // Platform: settings
  FEATURE_FLAG_CHANGED: "FEATURE_FLAG_CHANGED",
  SYSTEM_SETTING_CHANGED: "SYSTEM_SETTING_CHANGED",

  // Tenant: members
  TENANT_MEMBER_INVITED: "TENANT_MEMBER_INVITED",
  TENANT_MEMBER_ROLE_CHANGED: "TENANT_MEMBER_ROLE_CHANGED",
  TENANT_MEMBER_DEACTIVATED: "TENANT_MEMBER_DEACTIVATED",
  TENANT_MEMBER_REACTIVATED: "TENANT_MEMBER_REACTIVATED",

  // Tenant: settings
  TENANT_SETTINGS_CHANGED: "TENANT_SETTINGS_CHANGED",

  // OAuth
  GOOGLE_ACCOUNT_LINKED: "GOOGLE_ACCOUNT_LINKED",

  // Data Export
  DATA_EXPORT_REQUESTED: "DATA_EXPORT_REQUESTED",
  DATA_EXPORT_DOWNLOADED: "DATA_EXPORT_DOWNLOADED",

  // Account Security
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  ALL_SESSIONS_REVOKED: "ALL_SESSIONS_REVOKED",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface LogAuditParams {
  actorUserId?: string | null;
  actorPlatformRole?: string | null;
  actorBusinessId?: string | null;
  action: AuditAction | string;
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/** Write an audit log entry. Fire-and-forget — never throws. */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId ?? null,
        actorPlatformRole: params.actorPlatformRole ?? null,
        actorBusinessId: params.actorBusinessId ?? null,
        action: params.action,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        ipAddress: params.ip ?? null,
        userAgent: params.userAgent ?? null,
        metadataJson: JSON.stringify(params.metadata ?? {}),
      },
    });
  } catch (err) {
    // Audit logging must never break the main flow
    console.error("[audit] Failed to write audit log:", err);
  }
}

/** Extract request context (IP + User-Agent) from NextRequest */
export function getRequestContext(request: NextRequest): {
  ip: string | null;
  userAgent: string | null;
} {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;
  const userAgent = request.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}
