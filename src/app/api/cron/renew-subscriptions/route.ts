export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";
import { getPlanPrice } from "@/lib/cardcom-recurring";
import { reconcilePendingPayments } from "@/lib/cardcom-activation";
import {
  listTerminalTransactions,
  cardIdentityFromEventMetadata,
  findChargeForBusiness,
  type CardcomTransaction,
} from "@/lib/cardcom-transactions";

const OWNER_ALERT_EMAIL = "info@petra-app.com";

/**
 * GET /api/cron/renew-subscriptions
 *
 * Runs daily at 00:00 UTC — BEFORE expire-subscriptions (01:00 UTC).
 *
 * Cardcom bills subscribers automatically via הוראת קבע (RecurringPayments),
 * but nothing on Cardcom's side calls us back when a monthly charge succeeds.
 * Without this cron, a paying customer's `subscriptionEndsAt` passes and
 * expire-subscriptions downgrades them to free — while Cardcom keeps charging.
 *
 * Cardcom's RecurringPayment.aspx has no read operation — it answers
 * "8500 Unknow Operation 'Get'" — so the charge itself is what we look for.
 * One call to Transactions/ListTransactions covers every business in the run.
 *
 * For every business with an active subscription + cardcomRecurringId whose
 * period ends within the next 3 days (or up to 14 days ago):
 *   1. Find a successful charge on the card that business paid with, for the
 *      amount it is billed, dated on or after (subscriptionEndsAt - 3 days).
 *      That window starts well after the original activation charge, so only a
 *      genuine monthly renewal can match.
 *   2. Found → extend subscriptionEndsAt to charge date + 30 days (+2-day
 *      buffer) and log a "renew" event.
 *   3. Not found and more than 3 days past due → log "renew_overdue" + email
 *      the platform owner (declined card, or the order was cancelled at
 *      Cardcom — which we can no longer read directly).
 *   4. Any failure → log "renew_check_failed" + email. The business is NOT
 *      expired: expire-subscriptions gives recurring businesses a 7-day grace
 *      window, so a human can intervene before anyone loses access.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // ?mode=verify — read-only smoke test of the Cardcom transaction feed.
    // Confirms the credentials this cron depends on actually work in this
    // environment, without waiting for a business to reach its billing date.
    if (new URL(request.url).searchParams.get("mode") === "verify") {
      try {
        const tx = await listTerminalTransactions(new Date(now.getTime() - 21 * 86_400_000), now);
        return NextResponse.json({ ok: true, mode: "verify", transactionsFound: tx.length });
      } catch (err) {
        return NextResponse.json(
          { ok: false, mode: "verify", error: err instanceof Error ? err.message : String(err) },
          { status: 500 }
        );
      }
    }

    // ── Step 0: activate payments whose browser flow never completed ───────
    // A business still carrying cardcomPendingCode paid (or abandoned) a
    // LowProfile page. Verify with Cardcom and activate if it was paid, so a
    // charged customer is never left on free with no recurring order.
    const reconciled = await reconcilePendingPayments(now).catch((err) => {
      console.error("renew-subscriptions: reconcile failed:", err);
      return [];
    });
    const reconcileAlerts = reconciled
      .filter((r) => r.outcome === "activated" || r.outcome === "error")
      .map((r) =>
        r.outcome === "activated"
          ? `${r.businessName}: הופעל מנוי מתשלום שלא הושלם בדפדפן — ${r.detail ?? ""}`
          : `${r.businessName}: שגיאה באימות תשלום ממתין — ${r.detail ?? ""}`
      );

    const windowStart = new Date(now.getTime() - 14 * 86_400_000);
    const windowEnd = new Date(now.getTime() + 3 * 86_400_000);

    const businesses = await prisma.business.findMany({
      where: {
        subscriptionStatus: "active",
        cardcomRecurringId: { not: null },
        subscriptionEndsAt: { gte: windowStart, lte: windowEnd },
      },
      select: {
        id: true,
        name: true,
        tier: true,
        subscriptionEndsAt: true,
        cardcomRecurringId: true,
      },
    });

    let renewed = 0;
    let failures = 0;
    const alerts: string[] = [...reconcileAlerts];

    // One transaction fetch for the whole run. Covers the oldest business in the
    // window plus a few days of slack on either side.
    let transactions: CardcomTransaction[] = [];
    if (businesses.length > 0) {
      try {
        transactions = await listTerminalTransactions(
          new Date(windowStart.getTime() - 5 * 86_400_000),
          new Date(now.getTime() + 86_400_000),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("renew-subscriptions: transaction list failed:", err);
        alerts.push(`לא ניתן למשוך עסקאות מקארדקום — אי אפשר לאמת חידושים החודש: ${msg}`);
      }
    }

    for (const biz of businesses) {
      try {
        const outcome = await checkAndRenew(biz, now, transactions);
        if (outcome.renewed) renewed++;
        if (outcome.alert) {
          failures++;
          alerts.push(outcome.alert);
        }
      } catch (err) {
        failures++;
        const msg = err instanceof Error ? err.message : String(err);
        alerts.push(`${biz.name ?? biz.id} (recurring ${biz.cardcomRecurringId}): ${msg}`);
        console.error(`renew-subscriptions: error for business ${biz.id}:`, err);
        await prisma.subscriptionEvent.create({
          data: {
            businessId: biz.id,
            eventType: "renew_check_failed",
            tier: biz.tier,
            metadata: { recurringId: biz.cardcomRecurringId, error: msg },
          },
        }).catch(() => null);
      }
    }

    // ── Alert platform owner on anything that needs eyes ─────────────────────
    if (alerts.length > 0) {
      await sendEmail({
        to: OWNER_ALERT_EMAIL,
        subject: `‏⚠️ Petra: ${alerts.length} אירועי מנוי דורשים בדיקה`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;">
          <h3>אירועי מנוי מול קארדקום</h3>
          <p>מנויים שהופעלו אוטומטית מתשלום שלא הושלם בדפדפן, או עסקים בהוראת קבע פעילה שלא הצלחנו לאמת להם חיוב חודשי
          (להם יש חלון חסד של 7 ימים לפני downgrade). נא לבדוק בפאנל קארדקום (מסוף ${process.env.CARDCOM_TERMINAL_NUMBER ?? ""}):</p>
          <ul>${alerts.map((a) => `<li>${a.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</li>`).join("")}</ul>
        </div>`,
      }).catch((e) => console.error("renew-subscriptions: owner alert email failed:", e));
    }

    console.log(`renew-subscriptions: reconciled=${reconciled.length}, checked=${businesses.length}, renewed=${renewed}, failures=${failures}`);
    return NextResponse.json({
      ok: true,
      reconciled,
      checked: businesses.length,
      renewed,
      failures,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("renew-subscriptions: unhandled error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

interface BizRow {
  id: string;
  name: string | null;
  tier: string;
  subscriptionEndsAt: Date | null;
  cardcomRecurringId: string | null;
}

/**
 * Which card, and which monthly amount, does this business pay with?
 * Both come from the most recent activation event — the amount falls back to
 * the plan price of the tier that was actually paid for (a business can sit on
 * a higher tier granted by hand while being billed the price it agreed to).
 */
async function billingProfile(businessId: string, currentTier: string) {
  const event = await prisma.subscriptionEvent.findFirst({
    where: { businessId, eventType: { in: ["activate", "checkout_activate"] } },
    orderBy: { createdAt: "desc" },
    select: { amount: true, tier: true, metadata: true },
  });

  const paidTierRaw = (event?.metadata as Record<string, unknown> | null)?.["paidTier"];
  const paidTier = typeof paidTierRaw === "string" ? paidTierRaw : event?.tier ?? currentTier;
  const amount = event?.amount ?? getPlanPrice(paidTier)?.price ?? getPlanPrice(currentTier)?.price ?? null;

  return { identity: cardIdentityFromEventMetadata(event?.metadata), amount };
}

async function checkAndRenew(
  biz: BizRow,
  now: Date,
  transactions: CardcomTransaction[],
): Promise<{ renewed: boolean; alert: string | null }> {
  const label = `${biz.name ?? biz.id} (recurring ${biz.cardcomRecurringId})`;
  const endsAt = biz.subscriptionEndsAt!;

  const { identity, amount } = await billingProfile(biz.id, biz.tier);

  if (!amount) {
    throw new Error("לא ידוע הסכום החודשי — אין אירוע הפעלה עם סכום או מחירון לטיר");
  }
  if (!identity.cardOwnerId && !identity.last4) {
    throw new Error("אין פרטי כרטיס מההפעלה המקורית — לא ניתן להתאים חיוב לעסק");
  }
  if (transactions.length === 0) {
    throw new Error("רשימת העסקאות מקארדקום ריקה או לא נטענה");
  }

  // 3 days before the period ends: after the original charge (30 days earlier),
  // before Cardcom's billing date, so only a renewal can land in here.
  const notBefore = new Date(endsAt.getTime() - 3 * 86_400_000);
  const charge = findChargeForBusiness(transactions, identity, amount, notBefore);

  if (charge) {
    // +2-day buffer: the customer keeps access on billing morning even if this
    // cron runs a little after Cardcom's charge cycle.
    const newEndsAt = new Date(charge.chargedAt.getTime() + 32 * 86_400_000);
    if (newEndsAt.getTime() <= endsAt.getTime()) {
      return { renewed: false, alert: null }; // already credited this charge
    }
    await prisma.business.update({
      where: { id: biz.id },
      data: { subscriptionEndsAt: newEndsAt, subscriptionStatus: "active" },
    });
    await prisma.subscriptionEvent.create({
      data: {
        businessId: biz.id,
        eventType: "renew",
        tier: biz.tier,
        amount: charge.amount,
        metadata: {
          recurringId: biz.cardcomRecurringId,
          previousEndsAt: endsAt.toISOString(),
          newEndsAt: newEndsAt.toISOString(),
          chargedAt: charge.chargedAt.toISOString(),
          transactionId: charge.transactionId,
          approvalNumber: charge.approvalNumber,
        },
      },
    }).catch(() => null);
    console.log(`renew-subscriptions: renewed business ${biz.id} until ${newEndsAt.toISOString()}`);
    return { renewed: true, alert: null };
  }

  // No charge yet. Before the billing date that is simply normal; well past it
  // the card is probably declining, or the order was cancelled at Cardcom.
  const daysPastDue = (now.getTime() - endsAt.getTime()) / 86_400_000;
  if (daysPastDue > 3) {
    await prisma.subscriptionEvent.create({
      data: {
        businessId: biz.id,
        eventType: "renew_overdue",
        tier: biz.tier,
        metadata: {
          recurringId: biz.cardcomRecurringId,
          endsAt: endsAt.toISOString(),
          expectedAmount: amount,
          daysPastDue: Math.round(daysPastDue * 10) / 10,
        },
      },
    }).catch(() => null);
    return {
      renewed: false,
      alert: `${label}: לא נמצא חיוב חודשי של ₪${amount} — ${Math.floor(daysPastDue)} ימים באיחור`,
    };
  }

  return { renewed: false, alert: null };
}
