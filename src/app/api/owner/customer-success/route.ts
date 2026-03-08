export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  const authResult = await requirePlatformPermission(request, "platform.settings.write");
  if (isGuardError(authResult)) return authResult;

  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      name: true,
      tier: true,
      createdAt: true,
      members: {
        where: { role: "owner", isActive: true },
        take: 1,
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              lastLoginAt: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const now = new Date();

  // Fetch customer + appointment counts separately (avoids _count TS issues)
  const businessIds = businesses.map((b) => b.id);
  const [customerCounts, apptCounts] = await Promise.all([
    prisma.customer.groupBy({ by: ["businessId"], where: { businessId: { in: businessIds } }, _count: { _all: true } }),
    prisma.appointment.groupBy({ by: ["businessId"], where: { businessId: { in: businessIds } }, _count: { _all: true } }),
  ]);

  const customerMap = Object.fromEntries(customerCounts.map((r) => [r.businessId, r._count._all]));
  const apptMap = Object.fromEntries(apptCounts.map((r) => [r.businessId, r._count._all]));

  const rows = businesses.map((b) => {
    const owner = b.members[0]?.user ?? null;
    const daysActive = Math.floor(
      (now.getTime() - new Date(b.createdAt).getTime()) / 86400000
    );
    const lastLoginDaysAgo = owner?.lastLoginAt
      ? Math.floor((now.getTime() - new Date(owner.lastLoginAt).getTime()) / 86400000)
      : null;
    const customerCount = customerMap[b.id] ?? 0;
    const appointmentCount = apptMap[b.id] ?? 0;

    // Churn risk heuristic
    let churnRisk: "high" | "medium" | "healthy";
    if (
      daysActive > 7 &&
      (customerCount === 0 || (lastLoginDaysAgo !== null && lastLoginDaysAgo > 7))
    ) {
      churnRisk = "high";
    } else if (
      daysActive > 3 &&
      (customerCount <= 2 || (lastLoginDaysAgo !== null && lastLoginDaysAgo > 3))
    ) {
      churnRisk = "medium";
    } else {
      churnRisk = "healthy";
    }

    return {
      businessId: b.id,
      businessName: b.name,
      tier: b.tier,
      createdAt: b.createdAt,
      daysActive,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      lastLoginAt: owner?.lastLoginAt ?? null,
      lastLoginDaysAgo,
      customerCount,
      appointmentCount,
      churnRisk,
    };
  });

  const stats = {
    total: rows.length,
    highRisk: rows.filter((r) => r.churnRisk === "high").length,
    medium: rows.filter((r) => r.churnRisk === "medium").length,
    healthy: rows.filter((r) => r.churnRisk === "healthy").length,
  };

  return NextResponse.json({ rows, stats });
}
