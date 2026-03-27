export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

/**
 * POST /api/subscription/cancel
 *
 * Schedules cancellation at end of current billing period.
 * - Sets subscriptionStatus to "cancel_pending"
 * - Clears the stored Cardcom token (prevents future auto-charges)
 * - Keeps tier + subscriptionEndsAt intact → user retains full access until period ends
 *
 * The daily cron (charge-trials) downgrades tier → "free" once subscriptionEndsAt passes.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { tier: true, subscriptionStatus: true, subscriptionEndsAt: true, cardcomToken: true },
    });

    if (!business) {
      return NextResponse.json({ error: "עסק לא נמצא" }, { status: 404 });
    }

    if (business.tier === "free" || business.subscriptionStatus === "cancel_pending") {
      return NextResponse.json({ error: "אין מנוי פעיל לביטול" }, { status: 400 });
    }

    if (business.subscriptionStatus !== "active") {
      return NextResponse.json({ error: "אין מנוי פעיל לביטול" }, { status: 400 });
    }

    const previousTier = business.tier;

    await prisma.business.update({
      where: { id: businessId },
      data: {
        subscriptionStatus: "cancel_pending",
        cardcomToken:       null,
        cardcomTokenExpiry: null,
        // tier + subscriptionEndsAt stay as-is — access continues until period ends
      },
    });

    await prisma.subscriptionEvent.create({
      data: {
        businessId,
        eventType: "cancel_requested",
        tier:      previousTier,
        metadata: {
          requestedAt:       new Date().toISOString(),
          accessUntil:       business.subscriptionEndsAt?.toISOString() ?? null,
        },
      },
    });

    return NextResponse.json({ ok: true, accessUntil: business.subscriptionEndsAt?.toISOString() ?? null });
  } catch (error) {
    console.error("POST /api/subscription/cancel error:", error);
    return NextResponse.json({ error: "שגיאה בביטול המנוי" }, { status: 500 });
  }
}
