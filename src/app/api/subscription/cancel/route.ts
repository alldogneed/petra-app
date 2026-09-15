export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { validateOrigin } from "@/lib/security/cardcom-helpers";
import { cancelCardcomRecurring } from "@/lib/cardcom-recurring";
import { sendEmail } from "@/lib/email";

const OWNER_ALERT_EMAIL = "info@petra-app.com";

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

    // Cancel recurring order in Cardcom (הוראת קבע) if exists.
    // The customer's cancellation always goes through, but if Cardcom did not
    // confirm the stop we KEEP cardcomRecurringId (so the order is not forgotten
    // while still billing), record the failure, and alert the owner to stop it
    // by hand. Clearing it on failure is how a cancelled customer kept being charged.
    let recurringStillActive = false;
    if (business.cardcomRecurringId) {
      const recurringId = business.cardcomRecurringId;
      const cancelResult = await cancelCardcomRecurring(recurringId);
      recurringStillActive = !cancelResult.success;

      await prisma.subscriptionEvent.create({
        data: {
          businessId,
          eventType: cancelResult.success ? "recurring_cancelled" : "recurring_cancel_failed",
          tier: business.tier,
          metadata: { recurringId, error: cancelResult.error ?? null },
        },
      }).catch(() => null);

      if (!cancelResult.success) {
        console.error(`Cancel recurring failed for business ${businessId}:`, cancelResult.error);
        const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        await sendEmail({
          to: OWNER_ALERT_EMAIL,
          subject: `\u200F🚨 Petra: ביטול מנוי — הוראת קבע ${recurringId} לא כובתה בקארדקום`,
          html: `<div dir="rtl" style="font-family:Arial,sans-serif;">
            <h3>לקוח ביטל מנוי אבל הוראת הקבע עדיין פעילה</h3>
            <p>עסק: ${esc(businessId)}<br/>הוראת קבע: ${esc(recurringId)}<br/>שגיאת קארדקום: ${esc(cancelResult.error ?? "unknown")}</p>
            <p><b>יש לכבות את הוראת הקבע ידנית בפאנל קארדקום לפני מועד החיוב הבא.</b></p>
          </div>`,
        }).catch((e) => console.error("cancel: owner alert email failed:", e));
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
          ...(recurringStillActive ? {} : { cardcomRecurringId: null }),
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
          ...(recurringStillActive ? {} : { cardcomRecurringId: null }),
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
