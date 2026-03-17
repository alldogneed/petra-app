export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

/**
 * POST /api/subscription/cancel
 *
 * Cancels the current subscription or trial for the authenticated business.
 * - Clears the stored Cardcom token (no future auto-charges)
 * - Sets subscriptionStatus to "cancelled"
 * - Clears trialEndsAt
 * - Downgrades tier to "free"
 *
 * Note: this is immediate. The business loses paid features right away.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { tier: true, subscriptionStatus: true, trialEndsAt: true, cardcomToken: true },
    });

    if (!business) {
      return NextResponse.json({ error: "עסק לא נמצא" }, { status: 404 });
    }

    const wasTrial = business.trialEndsAt !== null && business.trialEndsAt > new Date();
    const wasActive = business.subscriptionStatus === "active";

    if (!wasTrial && !wasActive && business.tier === "free") {
      return NextResponse.json({ error: "אין מנוי פעיל לביטול" }, { status: 400 });
    }

    const previousTier = business.tier;

    await prisma.business.update({
      where: { id: businessId },
      data: {
        tier:               "free",
        subscriptionStatus: "cancelled",
        subscriptionEndsAt: null,
        trialEndsAt:        null,
        cardcomToken:       null,
        cardcomTokenExpiry: null,
      },
    });

    await prisma.subscriptionEvent.create({
      data: {
        businessId,
        eventType: "cancelled",
        tier:      previousTier,
        metadata: {
          cancelledAt: new Date().toISOString(),
          wasTrial,
          wasActive,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/subscription/cancel error:", error);
    return NextResponse.json({ error: "שגיאה בביטול המנוי" }, { status: 500 });
  }
}
