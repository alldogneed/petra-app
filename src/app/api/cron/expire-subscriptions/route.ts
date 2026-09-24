export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";
import { RECURRING_GRACE_DAYS } from "@/lib/subscription-access";

const OWNER_ALERT_EMAIL = "info@petra-app.com";

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

    // Sync contract request expiry: PENDING requests past expiresAt → EXPIRED
    // (the sign page already rejects expired tokens; this keeps the DB status
    // consistent for lists and resend logic)
    const expiredContracts = await prisma.contractRequest.updateMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      data: { status: "EXPIRED" },
    });
    if (expiredContracts.count > 0) {
      console.log(`expire-subscriptions: expired ${expiredContracts.count} contract requests`);
    }

    const sevenDaysAgo = new Date(now.getTime() - RECURRING_GRACE_DAYS * 86_400_000);

    // Find expired active subscriptions.
    // Businesses with a Cardcom recurring order (הוראת קבע) get a 7-day grace
    // window: Cardcom bills them automatically and the renew-subscriptions
    // cron extends subscriptionEndsAt after each charge. Expiring them on day
    // one would lock out paying customers whenever the renewal check lags.
    // "cancel_pending" is included as a safety net: charge-trials owns that
    // downgrade, but it silently skipped it for months, so a cancelled customer
    // kept a paid tier indefinitely. No grace window there — the customer asked
    // to stop and their recurring order is already cancelled.
    const expired = await prisma.business.findMany({
      where: {
        OR: [
          { subscriptionStatus: "active", cardcomRecurringId: null,          subscriptionEndsAt: { lt: now } },
          { subscriptionStatus: "active", cardcomRecurringId: { not: null }, subscriptionEndsAt: { lt: sevenDaysAgo } },
          { subscriptionStatus: "cancel_pending",                            subscriptionEndsAt: { lt: now } },
        ],
      },
      select: { id: true, name: true, tier: true, cardcomRecurringId: true, subscriptionStatus: true },
    });

    if (expired.length === 0) {
      return NextResponse.json({
        ok: true,
        expired: 0,
        contractsExpired: expiredContracts.count,
        timestamp: now.toISOString(),
      });
    }

    // Sequential operations (no $transaction — Supabase PgBouncer incompatible)
    const cancelledIds = expired.filter((b) => b.subscriptionStatus === "cancel_pending").map((b) => b.id);
    const lapsedIds = expired.filter((b) => b.subscriptionStatus !== "cancel_pending").map((b) => b.id);

    if (lapsedIds.length > 0) {
      await prisma.business.updateMany({
        where: { id: { in: lapsedIds } },
        data: { subscriptionStatus: "expired", tier: "free" },
      });
    }
    if (cancelledIds.length > 0) {
      await prisma.business.updateMany({
        where: { id: { in: cancelledIds } },
        data: { subscriptionStatus: "cancelled", tier: "free", subscriptionEndsAt: null },
      });
    }
    for (const b of expired) {
      const cancelled = b.subscriptionStatus === "cancel_pending";
      await prisma.subscriptionEvent.create({
        data: {
          businessId: b.id,
          eventType: cancelled ? "cancelled" : "expired",
          tier: b.tier,
          metadata: cancelled
            ? { previousTier: b.tier, cancelledAt: now.toISOString(), reason: "billing_period_ended" }
            : { previousTier: b.tier, expiredAt: now.toISOString() },
        },
      });
    }

    console.log(`expire-subscriptions: expired ${expired.length} businesses`);

    // A recurring business reaching this point means 7 days passed with no
    // verified renewal — human attention required (failed card, Cardcom issue).
    const recurringExpired = expired.filter((b) => b.cardcomRecurringId && b.subscriptionStatus === "active");
    if (recurringExpired.length > 0) {
      const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      await sendEmail({
        to: OWNER_ALERT_EMAIL,
        subject: `\u200F\ud83d\udea8 Petra: ${recurringExpired.length} מנויים עם הוראת קבע הורדו ל-free`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;">
          <h3>עסקים עם הוראת קבע פעילה פגו אחרי 7 ימי חסד</h3>
          <p>לא אומת חיוב חודשי מול קארדקום במשך 7 ימים והמנוי הורד ל-free. נא לבדוק בפאנל קארדקום:</p>
          <ul>${recurringExpired.map((b) => `<li>${esc(b.name ?? b.id)} — ${esc(b.tier)} (recurring ${esc(b.cardcomRecurringId ?? "")})</li>`).join("")}</ul>
        </div>`,
      }).catch((e) => console.error("expire-subscriptions: owner alert email failed:", e));
    }

    return NextResponse.json({
      ok: true,
      expired: expired.length,
      contractsExpired: expiredContracts.count,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("expire-subscriptions cron error:", error);
    return NextResponse.json({ error: "שגיאה בביצוע הcron" }, { status: 500 });
  }
}
