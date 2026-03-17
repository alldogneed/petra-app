export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { PLATFORM_PERMS } from "@/lib/permissions";

/**
 * GET /api/admin/subscriptions
 * Returns subscription stats + recent events for master admin dashboard.
 */
export async function GET(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.USERS_READ);
  if (isGuardError(guard)) return guard;

  const [
    activeCount,
    expiredCount,
    freeCount,
    recentEvents,
    tierCounts,
    expiringCount,
  ] = await Promise.all([
    prisma.business.count({ where: { subscriptionStatus: "active" } }),
    prisma.business.count({ where: { subscriptionStatus: "expired" } }),
    prisma.business.count({ where: { tier: "free" } }),
    prisma.subscriptionEvent.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: { business: { select: { name: true, email: true } } },
    }),
    prisma.business.groupBy({ by: ["tier"], _count: { id: true } }),
    prisma.business.count({
      where: {
        subscriptionStatus: "active",
        subscriptionEndsAt: {
          lt: new Date(Date.now() + 7 * 86_400_000),
          gt: new Date(),
        },
      },
    }),
  ]);

  return NextResponse.json({
    stats: {
      active: activeCount,
      expired: expiredCount,
      free: freeCount,
      expiringIn7Days: expiringCount,
    },
    tierCounts: Object.fromEntries(tierCounts.map((r) => [r.tier, r._count.id])),
    recentEvents,
  });
}

/**
 * PATCH /api/admin/subscriptions
 * Manually set a business's tier + subscription (for manual upgrades via WhatsApp).
 * Body: { businessId, tier, days? }
 */
export async function PATCH(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.USERS_READ);
  if (isGuardError(guard)) return guard;

  const body = await request.json();
  const { businessId, tier, days = 30 } = body;

  if (!businessId || !tier) {
    return NextResponse.json({ error: "businessId ו-tier נדרשים" }, { status: 400 });
  }

  const now = new Date();
  const subscriptionEndsAt = new Date(now.getTime() + days * 86_400_000);

  const updated = await prisma.business.update({
    where: { id: businessId },
    data: {
      tier,
      subscriptionStatus: tier === "free" ? "inactive" : "active",
      subscriptionEndsAt: tier === "free" ? null : subscriptionEndsAt,
    },
    select: { id: true, name: true, tier: true, subscriptionStatus: true, subscriptionEndsAt: true },
  });

  await prisma.subscriptionEvent.create({
    data: {
      businessId,
      eventType: "activate",
      tier,
      amount: null,
      metadata: { manual: true, setByAdmin: true, days },
    },
  });

  return NextResponse.json(updated);
}
