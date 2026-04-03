export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { PLATFORM_PERMS } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const guard = await requirePlatformPermission(request, PLATFORM_PERMS.USERS_READ);
    if (isGuardError(guard)) return guard;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      blockedUsers,
      mauRows,
      newSignups7d,
      activeTodayRows,
      topUsersRaw,
      activityByActionRaw,
      dailyActivityRaw,
    ] = await Promise.all([
      prisma.platformUser.count(),
      prisma.platformUser.count({ where: { isActive: true } }),
      prisma.platformUser.count({ where: { isActive: false } }),
      prisma.activityLog.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.platformUser.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.activityLog.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: todayStart } },
      }),
      // Top 5 most active users (last 30 days)
      prisma.activityLog.groupBy({
        by: ["userId", "userName"],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
      // Activity breakdown by action (last 30 days)
      prisma.activityLog.groupBy({
        by: ["action"],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      // Daily activity for the last 14 days
      prisma.activityLog.findMany({
        where: { createdAt: { gte: fourteenDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Build daily activity map
    const dailyMap: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = 0;
    }
    for (const log of dailyActivityRaw) {
      const key = new Date(log.createdAt).toISOString().slice(0, 10);
      if (key in dailyMap) dailyMap[key]++;
    }
    const dailyActivity = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

    return NextResponse.json({
      totalUsers,
      activeUsers,
      blockedUsers,
      mau: mauRows.length,
      newSignups7d,
      activeToday: activeTodayRows.length,
      topUsers: topUsersRaw.map((u) => ({
        userId: u.userId,
        userName: u.userName,
        count: u._count.id,
      })),
      activityByAction: activityByActionRaw.map((a) => ({
        action: a.action,
        count: a._count.id,
      })),
      dailyActivity,
    });
  } catch (error) {
    console.error("GET /api/admin/stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
