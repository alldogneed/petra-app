export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";

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
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

    // Find expired active subscriptions.
    // Businesses with a Cardcom recurring order (הוראת קבע) get a 7-day grace
    // window: Cardcom bills them automatically and the renew-subscriptions
    // cron extends subscriptionEndsAt after each charge. Expiring them on day
    // one would lock out paying customers whenever the renewal check lags.
    const expired = await prisma.business.findMany({
      where: {
        subscriptionStatus: "active",
        OR: [
          { cardcomRecurringId: null,           subscriptionEndsAt: { lt: now } },
          { cardcomRecurringId: { not: null },  subscriptionEndsAt: { lt: sevenDaysAgo } },
        ],
      },
      select: { id: true, name: true, tier: true, cardcomRecurringId: true },
    });

    if (expired.length === 0) {
      return NextResponse.json({ ok: true, expired: 0, timestamp: now.toISOString() });
    }

    // Sequential operations (no $transaction — Supabase PgBouncer incompatible)
    await prisma.business.updateMany({
      where: { id: { in: expired.map((b) => b.id) } },
      data: {
        subscriptionStatus: "expired",
        tier: "free",
      },
    });
    for (const b of expired) {
      await prisma.subscriptionEvent.create({
        data: {
          businessId: b.id,
          eventType: "expired",
          tier: b.tier,
          metadata: { previousTier: b.tier, expiredAt: now.toISOString() },
        },
      });
    }

    console.log(`expire-subscriptions: expired ${expired.length} businesses`);

    // A recurring business reaching this point means 7 days passed with no
    // verified renewal — human attention required (failed card, Cardcom issue).
    const recurringExpired = expired.filter((b) => b.cardcomRecurringId);
    if (recurringExpired.length > 0) {
      const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      await sendEmail({
        to: OWNER_ALERT_EMAIL,
        subject: `‏🚨 Petra: ${recurringExpired.length} מנויים עם הוראת קבע הורדו ל-free`,
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
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("expire-subscriptions cron error:", error);
    return NextResponse.json({ error: "שגיאה בביצוע הcron" }, { status: 500 });
  }
}
