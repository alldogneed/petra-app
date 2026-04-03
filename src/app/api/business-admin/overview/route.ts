export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const user = await getCurrentUser();
    if (!user || !["owner", "admin"].includes(user.businessRole ?? "") || !user.businessId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const bizId = user.businessId;

    // Only users who belong to THIS business
    const businessUsers = await prisma.businessUser.findMany({
      where: { businessId: bizId },
      select: { userId: true },
    });
    const userIds = businessUsers.map((bu) => bu.userId);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [teamCount, customerCount, todayAppts, monthlyRevenue, recentActivity] =
      await Promise.all([
        prisma.businessUser.count({
          where: { businessId: bizId, isActive: true },
        }),
        prisma.customer.count({ where: { businessId: bizId } }),
        prisma.appointment.count({
          where: {
            businessId: bizId,
            date: { gte: todayStart, lt: todayEnd },
            status: { not: "cancelled" },
          },
        }),
        prisma.payment.aggregate({
          where: {
            businessId: bizId,
            paidAt: { gte: monthStart },
            status: "paid",
          },
          _sum: { amount: true },
        }),
        // ActivityLog has no businessId — filter by members of THIS business only
        prisma.activityLog.findMany({
          where: { userId: { in: userIds } },
          orderBy: { createdAt: "desc" },
          take: 15,
        }),
      ]);

    return NextResponse.json({
      teamCount,
      customerCount,
      todayAppts,
      monthlyRevenue: monthlyRevenue._sum.amount ?? 0,
      recentActivity,
    });
  } catch (error) {
    console.error("business-admin/overview GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
