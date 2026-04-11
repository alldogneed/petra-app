export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { validateOrigin } from "@/lib/security/cardcom-helpers";
import { cancelCardcomRecurring } from "@/lib/cardcom-recurring";

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
    // CSRF protection
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "בקשה לא מורשית" }, { status: 403 });
    }

    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { tier: true, subscriptionStatus: true, subscriptionEndsAt: true, cardcomToken: true, cardcomRecurringId: true },
    });

    if (!business) {
      return NextResponse.json({ error: "עסק לא נמצא" }, { status: 404 });
    }

    if (business.tier === "free" || business.subscriptionStatus === "cancel_pending") {
      return NextResponse.json({ error: "אין מנוי פעיל לביטול" }, { status: 400 });
    }

    const previousTier = business.tier;

    // Cancel recurring order in Cardcom (הוראת קבע) if exists
    if (business.cardcomRecurringId) {
      const cancelResult = await cancelCardcomRecurring(business.cardcomRecurringId);
      if (!cancelResult.success) {
        console.error(`Cancel recurring failed for business ${businessId}:`, cancelResult.error);
        // Don't block cancellation — log and continue
      }
    }

    if (business.subscriptionStatus === "active" && business.subscriptionEndsAt) {
      // Active paid subscription — schedule cancellation at end of billing period
      await prisma.business.update({
        where: { id: businessId },
        data: {
          subscriptionStatus: "cancel_pending",
          cardcomToken:       null,
          cardcomTokenExpiry: null,
          cardcomRecurringId: null,
        },
      });
    } else {
      // No active subscription (manually assigned tier or expired) — downgrade immediately
      await prisma.business.update({
        where: { id: businessId },
        data: {
          tier: "free",
          subscriptionStatus: "cancelled",
          cardcomToken:       null,
          cardcomTokenExpiry: null,
          cardcomRecurringId: null,
          subscriptionEndsAt: null,
          trialEndsAt:        null,
        },
      });
    }

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
