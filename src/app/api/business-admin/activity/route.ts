export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (isGuardError(authResult)) return authResult;

  const user = await getCurrentUser();
  if (!user || !["owner", "admin"].includes(user.businessRole ?? "") || !user.businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bizId = user.businessId;

  const { searchParams } = new URL(request.url);
  const filterUserId = searchParams.get("userId");
  const filterAction = searchParams.get("action");
  const take = Math.min(parseInt(searchParams.get("take") || "50"), 100);

  // Get all user IDs that belong to THIS business
  const businessUsers = await prisma.businessUser.findMany({
    where: { businessId: bizId },
    select: { userId: true },
  });
  const bizUserIds = businessUsers.map((bu) => bu.userId);

  // If caller requests a specific userId, verify it belongs to this business
  const resolvedUserId =
    filterUserId && bizUserIds.includes(filterUserId) ? filterUserId : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    userId: resolvedUserId ? resolvedUserId : { in: bizUserIds },
  };
  if (filterAction) where.action = filterAction;

  const activities = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json(activities);
}
