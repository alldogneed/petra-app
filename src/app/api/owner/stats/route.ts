export const dynamic = 'force-dynamic';
/**
 * GET /api/owner/stats
 * Platform dashboard statistics.
 * Requires: platform_role in {super_admin, admin, support}
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth-guards";
import { isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { PLATFORM_ROLES } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const guard = await requirePlatformRole(request, [
    PLATFORM_ROLES.SUPER_ADMIN,
    PLATFORM_ROLES.ADMIN,
    PLATFORM_ROLES.SUPPORT,
  ]);
  if (isGuardError(guard)) return guard;

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    totalTenants,
    activeTenants,
    suspendedTenants,
    totalUsers,
    activeUsers,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({ where: { status: "active" } }),
    prisma.business.count({ where: { status: "suspended" } }),
    prisma.platformUser.count(),
    prisma.platformUser.count({ where: { isActive: true } }),
    prisma.auditLog.count({ where: { timestamp: { gte: last24h } } }),
  ]);

  return NextResponse.json({
    totalTenants,
    activeTenants,
    suspendedTenants,
    totalUsers,
    activeUsers,
    recentAuditLogs,
  });
}
