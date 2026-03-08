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

  const TIER_PRICES: Record<string, number> = {
    free: 0,
    basic: 99,
    groomer: 169,
    groomer_plus: 169,
    pro: 199,
    service_dog: 229,
  };

  const [
    totalTenants,
    activeTenants,
    suspendedTenants,
    totalUsers,
    activeUsers,
    recentAuditLogs,
    tierGroups,
    trialCount,
  ] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({ where: { status: "active" } }),
    prisma.business.count({ where: { status: "suspended" } }),
    prisma.platformUser.count(),
    prisma.platformUser.count({ where: { isActive: true } }),
    prisma.auditLog.count({ where: { timestamp: { gte: last24h } } }),
    prisma.business.groupBy({
      by: ["tier"],
      where: { status: "active" },
      _count: { id: true },
    }),
    prisma.business.count({ where: { status: "active", trialEndsAt: { gte: now } } }),
  ]);

  // Compute MRR: sum(count × price) for active businesses
  const tierBreakdown = tierGroups.map((g) => ({
    tier: g.tier,
    count: g._count.id,
    pricePerMonth: TIER_PRICES[g.tier] ?? 0,
    contribution: (g._count.id) * (TIER_PRICES[g.tier] ?? 0),
  }));
  const mrr = tierBreakdown.reduce((sum, g) => sum + g.contribution, 0);

  return NextResponse.json({
    totalTenants,
    activeTenants,
    suspendedTenants,
    totalUsers,
    activeUsers,
    recentAuditLogs,
    mrr,
    trialCount,
    tierBreakdown,
  });
}
