import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session || session.user.role !== "MASTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
