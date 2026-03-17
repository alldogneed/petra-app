export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";

/**
 * GET /api/cron/expire-subscriptions
 *
 * Runs daily. Finds all businesses where subscriptionEndsAt < now
 * and subscriptionStatus = "active", marks them as "expired" and
 * downgrades their stored tier to "free".
 *
 * Note: auth.ts already computes businessEffectiveTier = "free" when
 * subscriptionEndsAt has passed, so UI is always correct even without
 * this cron. This cron keeps the DB consistent and logs expiry events.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find expired active subscriptions
    const expired = await prisma.business.findMany({
      where: {
        subscriptionStatus: "active",
        subscriptionEndsAt: { lt: now },
      },
      select: { id: true, tier: true },
    });

    if (expired.length === 0) {
      return NextResponse.json({ ok: true, expired: 0, timestamp: now.toISOString() });
    }

    // Downgrade each business and log the event
    await prisma.$transaction([
      prisma.business.updateMany({
        where: { id: { in: expired.map((b) => b.id) } },
        data: {
          subscriptionStatus: "expired",
          tier: "free",
        },
      }),
      ...expired.map((b) =>
        prisma.subscriptionEvent.create({
          data: {
            businessId: b.id,
            eventType: "expired",
            tier: b.tier,
            metadata: { previousTier: b.tier, expiredAt: now.toISOString() },
          },
        })
      ),
    ]);

    console.log(`expire-subscriptions: expired ${expired.length} businesses`);

    return NextResponse.json({
      ok: true,
      expired: expired.length,
      businessIds: expired.map((b) => b.id),
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("expire-subscriptions cron error:", error);
    return NextResponse.json({ error: "שגיאה בביצוע הcron" }, { status: 500 });
  }
}
