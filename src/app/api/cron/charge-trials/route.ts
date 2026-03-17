export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";

const CARDCOM_PLANS: Record<string, { price: number; label: string }> = {
  basic:       { price: 99,  label: "Petra בייסיק" },
  pro:         { price: 199, label: "Petra פרו" },
  groomer:     { price: 169, label: "Petra גרומר+" },
  service_dog: { price: 229, label: "Petra Service Dog" },
};

const TIER_LABEL: Record<string, string> = {
  basic:       "בייסיק",
  pro:         "פרו",
  groomer:     "גרומר+",
  service_dog: "Service Dog",
};

/**
 * GET /api/cron/charge-trials
 *
 * Runs daily at 06:00. Finds businesses whose free trial has ended,
 * have a stored Cardcom token, and are not yet on an active subscription.
 * Charges them via Cardcom BillGold and activates their subscription.
 *
 * A business is eligible if:
 *   - trialEndsAt < now (trial expired)
 *   - trialEndsAt > now - 3 days (don't retry very old trials)
 *   - cardcomToken IS NOT NULL
 *   - subscriptionStatus != "active"
 *   - status = "active" (business is not suspended)
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 86_400_000);

    const businesses = await prisma.business.findMany({
      where: {
        trialEndsAt: { lt: now, gt: threeDaysAgo },
        cardcomToken: { not: null },
        subscriptionStatus: { not: "active" },
        status: "active",
      },
      select: {
        id: true,
        tier: true,
        email: true,
        name: true,
        cardcomToken: true,
        cardcomTokenExpiry: true,
      },
    });

    if (businesses.length === 0) {
      return NextResponse.json({ ok: true, charged: 0, errors: 0, timestamp: now.toISOString() });
    }

    let charged = 0;
    let errors = 0;

    for (const biz of businesses) {
      try {
        const plan = CARDCOM_PLANS[biz.tier];
        if (!plan) {
          console.warn(`charge-trials: unknown tier ${biz.tier} for business ${biz.id} — skipping`);
          continue;
        }

        // ── Charge via Cardcom BillGold token API ────────────────────────────
        const chargeParams = new URLSearchParams({
          TerminalNumber: process.env.CARDCOM_TERMINAL_NUMBER ?? "",
          UserName:       process.env.CARDCOM_API_USERNAME ?? "",
          APILevel:       "10",
          codepage:       "65001",
          Operation:      "2",          // charge with stored token
          SumToBill:      plan.price.toString(),
          CoinID:         "1",          // ILS
          ProductName:    plan.label,
          Token:          biz.cardcomToken!,
          ...(biz.cardcomTokenExpiry ? { TokenExDate: biz.cardcomTokenExpiry } : {}),
          UserId:         `${biz.id}::${biz.tier}`,
        });

        const chargeRes = await fetch(
          "https://secure.cardcom.solutions/Interface/BillGold.aspx",
          { method: "POST", body: chargeParams }
        );
        const chargeText = await chargeRes.text();

        const result: Record<string, string> = {};
        chargeText.split("&").forEach((pair) => {
          const eqIdx = pair.indexOf("=");
          if (eqIdx === -1) return;
          const k = decodeURIComponent(pair.slice(0, eqIdx));
          const v = decodeURIComponent(pair.slice(eqIdx + 1));
          result[k] = v;
        });

        if (result.ResponseCode !== "0") {
          console.error(`charge-trials: Cardcom charge failed for business ${biz.id}:`, result);
          await prisma.subscriptionEvent.create({
            data: {
              businessId: biz.id,
              eventType: "charge_failed",
              tier: biz.tier,
              amount: plan.price,
              metadata: {
                responseCode: result.ResponseCode,
                description: result.Description ?? "",
                attemptedAt: now.toISOString(),
              },
            },
          });
          errors++;
          continue;
        }

        // ── Activate subscription for 30 days ───────────────────────────────
        const subscriptionEndsAt = new Date(now.getTime() + 30 * 86_400_000);

        await prisma.business.update({
          where: { id: biz.id },
          data: {
            subscriptionStatus:  "active",
            subscriptionEndsAt,
            trialEndsAt:         null,
            cardcomDealId:       result.DealNumber ?? null,
          },
        });

        await prisma.subscriptionEvent.create({
          data: {
            businessId:    biz.id,
            eventType:     "charge_success",
            tier:          biz.tier,
            amount:        plan.price,
            cardcomDealId: result.DealNumber ?? null,
            metadata: {
              dealNumber:         result.DealNumber ?? "",
              subscriptionEndsAt: subscriptionEndsAt.toISOString(),
              chargedAt:          now.toISOString(),
            },
          },
        });

        // ── Send confirmation email ──────────────────────────────────────────
        const recipientEmail = biz.email;
        if (recipientEmail) {
          const tierName = TIER_LABEL[biz.tier] ?? biz.tier;
          const endsFormatted = subscriptionEndsAt.toLocaleDateString("he-IL");
          await sendEmail({
            to: recipientEmail,
            subject: `✅ תשלום התקבל — מנוי Petra ${tierName} פעיל`,
            html: `
              <div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
                <h2 style="color:#f97316">תשלום התקבל בהצלחה!</h2>
                <p>שלום <strong>${biz.name}</strong>,</p>
                <p>המנוי שלך למסלול <strong>${tierName}</strong> פעיל עד <strong>${endsFormatted}</strong>.</p>
                <p>סכום שחויב: <strong>₪${plan.price}</strong></p>
                <p style="color:#64748b;font-size:12px">
                  לניהול המנוי, כניסה לחשבון ← הגדרות ← מנוי.
                </p>
              </div>
            `,
          }).catch((e) => console.error(`charge-trials: failed to send email to ${recipientEmail}:`, e));
        }

        charged++;
        console.log(`charge-trials: charged ₪${plan.price} for business ${biz.id} (${biz.tier}), deal ${result.DealNumber}`);

      } catch (err) {
        console.error(`charge-trials: error processing business ${biz.id}:`, err);
        errors++;
      }
    }

    console.log(`charge-trials: done. charged=${charged}, errors=${errors}, total=${businesses.length}`);

    return NextResponse.json({
      ok: true,
      charged,
      errors,
      total: businesses.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("charge-trials cron error:", error);
    return NextResponse.json({ error: "שגיאה בביצוע הcron" }, { status: 500 });
  }
}
