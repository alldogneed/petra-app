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

function israelYmd(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

/** UTC instant of 00:00 Israel time on the given YYYY-MM-DD (DST-aware). */
function israelMidnightUtc(ymd: string): Date {
  const utcMidnight = new Date(`${ymd}T00:00:00.000Z`);
  const israelHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", hourCycle: "h23" }).format(utcMidnight)
  );
  return new Date(utcMidnight.getTime() - israelHour * 3_600_000);
}

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
  const thirtyDaysAgo = new Date(now.getTime() - 30 * day);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * day);
  // Day buckets follow the Israeli calendar day, not the server's UTC day
  const days = Array.from({ length: 14 }, (_, i) => {
    const ymd = israelYmd(new Date(now.getTime() - (13 - i) * day));
    return { ymd, start: israelMidnightUtc(ymd) };
  });
  const todayStart = days[13].start;

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
      // Explicit select — never ship Cardcom deal ids / payer IPs to the dashboard
      select: { id: true, createdAt: true, business: { select: { id: true, name: true } } },
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
  ]);

  // One bounded count per day instead of loading every log row of the last 14 days
  const dailyCounts = await Promise.all(
    days.map((d, i) =>
      prisma.activityLog.count({
        where: {
          ...activityScope,
          createdAt: { gte: d.start, ...(i < 13 ? { lt: days[i + 1].start } : {}) },
        },
      })
    )
  );

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
      dailyActivity: days.map((d, i) => ({ date: d.ymd, count: dailyCounts[i] })),
    },
  });
  } catch (error) {
    console.error("GET /api/owner/stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
