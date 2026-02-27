import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { PLATFORM_PERMS } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.USERS_READ);
  if (isGuardError(guard)) return guard;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const where = search
    ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] }
    : {};

  const [users, total] = await Promise.all([
    prisma.platformUser.findMany({
      where: where as any,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        businessMemberships: {
          where: { isActive: true },
          include: { business: { select: { name: true, tier: true } } },
          take: 1,
        },
      },
    }),
    prisma.platformUser.count({ where: where as any }),
  ]);

  // Get activity scores and last activity for each user
  const userIds = users.map((u) => u.id);
  const [activityCounts, lastActivities] = await Promise.all([
    prisma.activityLog.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, createdAt: { gte: thirtyDaysAgo } },
      _count: true,
    }),
    prisma.activityLog.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: "desc" },
      distinct: ["userId"],
      select: { userId: true, createdAt: true },
    }),
  ]);

  const scoreMap = new Map(activityCounts.map((a) => [a.userId, a._count]));
  const lastMap = new Map(lastActivities.map((a) => [a.userId, a.createdAt]));

  const enrichedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
    businessName: u.businessMemberships[0]?.business?.name || null,
    businessTier: u.businessMemberships[0]?.business?.tier || null,
    activityScore: scoreMap.get(u.id) || 0,
    lastActivityAt: lastMap.get(u.id) || null,
  }));

  return NextResponse.json({ users: enrichedUsers, total, page, limit });
}
