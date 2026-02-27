export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { PLATFORM_PERMS } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.USERS_READ);
  if (isGuardError(guard)) return guard;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalUsers, mauRows, newSignups7d] = await Promise.all([
    prisma.platformUser.count({ where: { isActive: true } }),
    prisma.activityLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.platformUser.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
  ]);

  return NextResponse.json({
    totalUsers,
    mau: mauRows.length,
    newSignups7d,
  });
}
