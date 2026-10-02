export const dynamic = 'force-dynamic';
/**
 * GET /api/owner/stats
 * Platform dashboard: revenue, tenants, usage and "needs attention" items.
 * Test businesses/users are excluded unless `?includeTest=1`.
 * Requires: platform_role in {super_admin, admin, support}
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth-guards";
import { isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { PLATFORM_ROLES } from "@/lib/permissions";
import { getTestBusinessIds, getTestUserIds, wantsTestData } from "@/lib/platform-test-accounts";

const TIER_PRICES: Record<string, number> = {
  free: 0,
  basic: 99,
  groomer: 169,
  groomer_plus: 169,
  pro: 199,
  service_dog: 229,
};

export async function GET(request: NextRequest) {
  try {
  const guard = await requirePlatformRole(request, [
    PLATFORM_ROLES.SUPER_ADMIN,
    PLATFORM_ROLES.ADMIN,
    PLATFORM_ROLES.SUPPORT,
  ]);
  if (isGuardError(guard)) return guard;

  const includeTest = wantsTestData(new URL(request.url).searchParams);
  const [testBusinessIds, testUserIds] = includeTest
    ? [new Set<string>(), new Set<string>()]
    : await Promise.all([getTestBusinessIds(), getTestUserIds()]);
  const testBiz = Array.from(testBusinessIds);
  const testUsers = Array.from(testUserIds);

  const bizScope = testBiz.length ? { id: { notIn: testBiz } } : {};
  const userScope = testUsers.length ? { id: { notIn: testUsers } } : {};
  const activityScope = testUsers.length ? { userId: { notIn: testUsers } } : {};

  const now = new Date();
  const day = 86_400_000;
  const last24h = new Date(now.getTime() - day);
  const sevenDaysAgo = new Date(now.getTime() - 7 * day);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * day);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * day);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * day);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalTenants,
    activeTenants,
    suspendedTenants,
    totalUsers,
    activeUsers,
    blockedUsers,
    recentAuditLogs,
    tierGroups,
    trialCount,
    gcalConnectedCount,
    activeSubscriptions,
    expiringSoon,
    recentPayments,
    openSupportTickets,
    newSignups7d,
    mauRows,
    activeTodayRows,
    topUsersRaw,
    activityByActionRaw,
    dailyActivityRaw,
  ] = await Promise.all([
    prisma.business.count({ where: bizScope }),
    prisma.business.count({ where: { ...bizScope, status: "active" } }),
    prisma.business.count({ where: { ...bizScope, status: "suspended" } }),
    prisma.platformUser.count({ where: userScope }),
    prisma.platformUser.count({ where: { ...userScope, isActive: true } }),
    prisma.platformUser.count({ where: { ...userScope, isActive: false } }),
    prisma.auditLog.count({ where: { timestamp: { gte: last24h } } }),
    prisma.business.groupBy({
      by: ["tier"],
      where: { ...bizScope, status: "active" },
      _count: { id: true },
    }),
    prisma.business.count({ where: { ...bizScope, status: "active", trialEndsAt: { gte: now } } }),
    prisma.platformUser.count({ where: { ...userScope, gcalConnected: true, isActive: true } }),
    prisma.business.count({ where: { ...bizScope, subscriptionStatus: "active" } }),
    prisma.business.findMany({
      where: {
        ...bizScope,
        subscriptionStatus: "active",
        subscriptionEndsAt: { lt: sevenDaysFromNow, gt: now },
      },
      orderBy: { subscriptionEndsAt: "asc" },
      take: 10,
      select: { id: true, name: true, tier: true, subscriptionEndsAt: true },
    }),
    prisma.subscriptionEvent.findMany({
      take: 8,
      where: {
        eventType: "activate",
        ...(testBiz.length ? { businessId: { notIn: testBiz } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { business: { select: { id: true, name: true } } },
    }),
    prisma.supportTicket.count({ where: { status: { in: ["open", "in_progress"] } } }),
    prisma.platformUser.count({ where: { ...userScope, createdAt: { gte: sevenDaysAgo } } }),
    prisma.activityLog.groupBy({
      by: ["userId"],
      where: { ...activityScope, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.activityLog.groupBy({
      by: ["userId"],
      where: { ...activityScope, createdAt: { gte: todayStart } },
    }),
    prisma.activityLog.groupBy({
      by: ["userId", "userName"],
      where: { ...activityScope, createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    prisma.activityLog.groupBy({
      by: ["action"],
      where: { ...activityScope, createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 8,
    }),
    prisma.activityLog.findMany({
      where: { ...activityScope, createdAt: { gte: fourteenDaysAgo } },
      select: { createdAt: true },
    }),
  ]);

  // MCP errors in the last 24h (best-effort — never fails the dashboard)
  let mcpErrors24h = 0;
  try {
    mcpErrors24h = await prisma.mcpAuditLog.count({
      where: { createdAt: { gte: last24h }, status: "error" },
    });
  } catch {
    mcpErrors24h = 0;
  }

  // MRR: sum(count × price) for active businesses
  const tierBreakdown = tierGroups.map((g) => ({
    tier: g.tier,
    count: g._count.id,
    pricePerMonth: TIER_PRICES[g.tier] ?? 0,
    contribution: g._count.id * (TIER_PRICES[g.tier] ?? 0),
  }));
  const mrr = tierBreakdown.reduce((sum, g) => sum + g.contribution, 0);

  const dailyMap: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    dailyMap[new Date(now.getTime() - i * day).toISOString().slice(0, 10)] = 0;
  }
  for (const log of dailyActivityRaw) {
    const key = new Date(log.createdAt).toISOString().slice(0, 10);
    if (key in dailyMap) dailyMap[key]++;
  }

  return NextResponse.json({
    includeTest,
    excludedTestBusinesses: testBiz.length,
    totalTenants,
    activeTenants,
    suspendedTenants,
    totalUsers,
    activeUsers,
    blockedUsers,
    recentAuditLogs,
    mrr,
    trialCount,
    tierBreakdown,
    gcalConnectedCount,
    activeSubscriptions,
    expiringIn7Days: expiringSoon.length,
    expiringSoon,
    recentPayments,
    attention: {
      openSupportTickets,
      expiringSubscriptions: expiringSoon.length,
      suspendedTenants,
      mcpErrors24h,
    },
    usage: {
      mau: mauRows.length,
      activeToday: activeTodayRows.length,
      newSignups7d,
      topUsers: topUsersRaw.map((u) => ({ userId: u.userId, userName: u.userName, count: u._count.id })),
      activityByAction: activityByActionRaw.map((a) => ({ action: a.action, count: a._count.id })),
      dailyActivity: Object.entries(dailyMap).map(([date, count]) => ({ date, count })),
    },
  });
  } catch (error) {
    console.error("GET /api/owner/stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
