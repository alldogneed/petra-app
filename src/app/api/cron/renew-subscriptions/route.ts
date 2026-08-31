export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";
import { parseCardcomResponse } from "@/lib/cardcom-recurring";

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
 * For every business with an active subscription + cardcomRecurringId whose
 * period ends within the next 3 days (or up to 14 days ago):
 *   1. Query Cardcom RecurringPayment (Operation=Get) for the recurring order.
 *   2. If the order is active and its NextDateToBill is AFTER our current
 *      subscriptionEndsAt → Cardcom already billed the customer for the next
 *      period → extend subscriptionEndsAt to NextDateToBill + 2-day buffer
 *      and log a "renew" event.
 *   3. If the order was deactivated at Cardcom (customer canceled there) →
 *      log "recurring_inactive" + email the platform owner.
 *   4. If the API call fails or the response can't be parsed → log
 *      "renew_check_failed" + email the platform owner. The business is NOT
 *      expired: expire-subscriptions gives recurring businesses a 7-day grace
 *      window, so a human can intervene before anyone loses access.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
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

    if (businesses.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, renewed: 0, timestamp: now.toISOString() });
    }

    let renewed = 0;
    let failures = 0;
    const alerts: string[] = [];

    for (const biz of businesses) {
      try {
        const outcome = await checkAndRenew(biz, now);
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

    // ── Alert platform owner on any failure — manual verification needed ────
    if (alerts.length > 0) {
      await sendEmail({
        to: OWNER_ALERT_EMAIL,
        subject: `‏⚠️ Petra: ${alerts.length} מנויים דורשים בדיקת חידוש ידנית`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;">
          <h3>בדיקת חידוש מנוי מול קארדקום נכשלה</h3>
          <p>העסקים הבאים בהוראת קבע פעילה אך לא הצלחנו לאמת חיוב חודשי מול קארדקום.
          יש להם חלון חסד של 7 ימים לפני downgrade — נא לבדוק ידנית בפאנל קארדקום (מסוף ${process.env.CARDCOM_TERMINAL_NUMBER ?? ""}):</p>
          <ul>${alerts.map((a) => `<li>${a.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</li>`).join("")}</ul>
        </div>`,
      }).catch((e) => console.error("renew-subscriptions: owner alert email failed:", e));
    }

    console.log(`renew-subscriptions: checked=${businesses.length}, renewed=${renewed}, failures=${failures}`);
    return NextResponse.json({
      ok: true,
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

/** Parse Cardcom's dd/MM/yyyy date format. Returns null on garbage. */
function parseCardcomDate(s: string | undefined): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10)));
  return isNaN(d.getTime()) ? null : d;
}

async function checkAndRenew(
  biz: BizRow,
  now: Date,
): Promise<{ renewed: boolean; alert: string | null }> {
  const terminalNumber = process.env.CARDCOM_TERMINAL_NUMBER ?? "";
  const userName = process.env.CARDCOM_API_USERNAME ?? "";
  const label = `${biz.name ?? biz.id} (recurring ${biz.cardcomRecurringId})`;

  // ── Query the recurring order at Cardcom ──────────────────────────────────
  const body = new URLSearchParams({
    TerminalNumber: terminalNumber,
    UserName: userName,
    Operation: "Get",
    "RecurringPayments.RecurringId": biz.cardcomRecurringId!,
  });

  const res = await fetch(
    "https://secure.cardcom.solutions/interface/RecurringPayment.aspx",
    { method: "POST", body }
  );
  if (!res.ok) {
    throw new Error(`Cardcom HTTP ${res.status}`);
  }
  const data = parseCardcomResponse(await res.text());

  if (data.ResponseCode !== "0") {
    throw new Error(`Cardcom ResponseCode=${data.ResponseCode}: ${data.Description ?? ""}`);
  }

  // Response fields are prefixed Recurring0.* (same shape as NewAndUpdate response)
  const isActiveRaw = (data["Recurring0.IsActive"] ?? data.IsActive ?? "").toLowerCase();
  const nextBillRaw = data["Recurring0.NextDateToBill"] ?? data.NextDateToBill;
  const nextBill = parseCardcomDate(nextBillRaw);

  // ── Recurring order deactivated at Cardcom side ───────────────────────────
  if (isActiveRaw === "false") {
    console.warn(`renew-subscriptions: recurring inactive for business ${biz.id}`);
    await prisma.subscriptionEvent.create({
      data: {
        businessId: biz.id,
        eventType: "recurring_inactive",
        tier: biz.tier,
        // Deliberately NOT storing the raw response — it may contain card tokens
        metadata: {
          recurringId: biz.cardcomRecurringId,
          responseCode: data.ResponseCode ?? "",
          description: data.Description ?? "",
          nextDateToBill: nextBillRaw ?? "",
        },
      },
    }).catch(() => null);
    return { renewed: false, alert: `${label}: הוראת הקבע כבויה בקארדקום` };
  }

  if (!nextBill) {
    throw new Error(`unparseable NextDateToBill: "${nextBillRaw ?? "missing"}"`);
  }

  const endsAt = biz.subscriptionEndsAt!;

  // ── NextDateToBill after our period end → Cardcom already billed ──────────
  // At creation NextDateToBill == subscriptionEndsAt (both +30d). After each
  // successful monthly charge Cardcom advances NextDateToBill by one interval,
  // so nextBill > endsAt proves a charge happened for the next period.
  if (nextBill.getTime() > endsAt.getTime()) {
    // +2-day buffer: customer keeps access on billing morning even if this
    // cron runs a bit after Cardcom's charge cycle.
    const newEndsAt = new Date(nextBill.getTime() + 2 * 86_400_000);
    await prisma.business.update({
      where: { id: biz.id },
      data: { subscriptionEndsAt: newEndsAt, subscriptionStatus: "active" },
    });
    await prisma.subscriptionEvent.create({
      data: {
        businessId: biz.id,
        eventType: "renew",
        tier: biz.tier,
        metadata: {
          recurringId: biz.cardcomRecurringId,
          previousEndsAt: endsAt.toISOString(),
          newEndsAt: newEndsAt.toISOString(),
          nextDateToBill: nextBillRaw ?? "",
        },
      },
    }).catch(() => null);
    console.log(`renew-subscriptions: renewed business ${biz.id} until ${newEndsAt.toISOString()}`);
    return { renewed: true, alert: null };
  }

  // ── Not billed yet ────────────────────────────────────────────────────────
  // Billing date hasn't arrived (endsAt within next 3 days) — nothing to do,
  // grace in expire-subscriptions covers the gap. But if we're already >3 days
  // past due and Cardcom still hasn't advanced the billing date, the charge is
  // probably failing (declined card) — alert the owner.
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
          nextDateToBill: nextBillRaw ?? "",
          daysPastDue: Math.round(daysPastDue * 10) / 10,
        },
      },
    }).catch(() => null);
    return { renewed: false, alert: `${label}: חיוב חודשי לא בוצע — ${Math.floor(daysPastDue)} ימים באיחור` };
  }

  return { renewed: false, alert: null };
}
