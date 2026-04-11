export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";
import { decryptCardcomToken } from "@/lib/encryption";

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
        address: true,
        vatNumber: true,
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

        // ── Pre-check: skip if token has expired (MMYY format) ──────────────
        if (biz.cardcomTokenExpiry) {
          const expiry = biz.cardcomTokenExpiry; // e.g. "0128" = Jan 2028
          const expMonth = parseInt(expiry.slice(0, 2), 10);
          const expYear = 2000 + parseInt(expiry.slice(2, 4), 10);
          const expiryDate = new Date(expYear, expMonth, 0); // last day of exp month
          if (expiryDate < now) {
            console.warn(`charge-trials: token expired (${expiry}) for business ${biz.id} — skipping`);
            await prisma.subscriptionEvent.create({
              data: { businessId: biz.id, eventType: "token_expired", tier: biz.tier, metadata: { tokenExpiry: expiry } },
            }).catch(() => null);
            errors++;
            continue;
          }
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
          Token:          decryptCardcomToken(biz.cardcomToken!),
          ...(biz.cardcomTokenExpiry ? { TokenExDate: biz.cardcomTokenExpiry } : {}),
          UserId:         `${biz.id}::${biz.tier}`,
          // ── Invoice generation (חשבונית מס קבלה) ──────────────────────────
          "InvoiceHead.CustName":        biz.name ?? "",
          "InvoiceHead.CustAddressFull": biz.address ?? "",
          "InvoiceHead.CustEmail":       biz.email ?? "",
          "InvoiceHead.SendEmail":       "true",
          "InvoiceHead.Language":        "he",
          "InvoiceHead.DocType":         "320",   // חשבונית מס קבלה
          ...(biz.vatNumber ? { "InvoiceHead.CustVatNumber": biz.vatNumber } : {}),
          "InvoiceLines1.Description":   `מנוי ${plan.label} — חודש אחד`,
          "InvoiceLines1.Price":         plan.price.toString(),
          "InvoiceLines1.Quantity":      "1",
          "InvoiceLines1.IsSumIncludeTax": "true",
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
          const safeName = (biz.name ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
          await sendEmail({
            to: recipientEmail,
            subject: `\u200F✅ תשלום התקבל — מנוי Petra ${tierName} פעיל`,
            html: `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:'Segoe UI',Arial,sans-serif;direction:rtl;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px;direction:rtl;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;direction:rtl;">
      <tr><td style="background:#F97316;height:4px;border-radius:12px 12px 0 0;"></td></tr>
      <tr>
        <td style="background:#0F172A;padding:24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;">
            <tr>
              <td style="text-align:right;"><span style="color:#F97316;font-size:22px;font-weight:800;">Petra 🐾</span></td>
              <td style="text-align:left;"><span style="background:#1E293B;color:#94A3B8;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;">✓ תשלום התקבל</span></td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="background:#FFFFFF;border:1px solid #E2E8F0;border-top:none;padding:32px;direction:rtl;">
          <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0F172A;text-align:right;">שלום ${safeName} 👋</h2>
          <p style="margin:0 0 28px;font-size:15px;color:#64748B;line-height:1.6;text-align:right;">
            התשלום התקבל בהצלחה והמנוי שלך פעיל.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;border-radius:12px;margin:0 0 28px;direction:rtl;">
            <tr>
              <td style="padding:20px 24px;">
                <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.08em;text-align:right;">פרטי החיוב</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;">
                  <tr>
                    <td style="padding:6px 0;color:#94A3B8;font-size:13px;width:100px;text-align:right;">📦 מסלול</td>
                    <td style="padding:6px 0;color:#F8FAFC;font-size:14px;font-weight:600;text-align:right;">Petra ${tierName}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#94A3B8;font-size:13px;text-align:right;">💳 סכום</td>
                    <td style="padding:6px 0;color:#FB923C;font-size:16px;font-weight:700;text-align:right;">₪${plan.price}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#94A3B8;font-size:13px;text-align:right;">📅 פעיל עד</td>
                    <td style="padding:6px 0;color:#F8FAFC;font-size:14px;font-weight:600;text-align:right;">${endsFormatted}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;direction:rtl;">
            <tr>
              <td style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:14px 18px;text-align:right;">
                <p style="margin:0;font-size:13px;color:#9A3412;line-height:1.6;text-align:right;">
                  🧾 <strong>חשבונית מס קבלה</strong> נשלחה למייל זה מ-Cardcom בנפרד.
                </p>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
            <tr>
              <td align="center">
                <a href="https://petra-app.com/login" style="display:inline-block;background:#F97316;color:#ffffff;font-size:15px;font-weight:700;padding:14px 44px;border-radius:10px;text-decoration:none;">
                  כניסה למערכת ←
                </a>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;">
            <tr>
              <td style="border-top:1px solid #E2E8F0;padding-top:20px;text-align:right;">
                <p style="margin:0;font-size:12px;color:#94A3B8;line-height:1.9;text-align:right;">
                  ✅ חידוש אוטומטי בעוד 30 יום · ביטול בכל עת ללא קנסות<br/>
                  לניהול המנוי: <span style="color:#F97316;">הגדרות ← ניהול מנוי</span>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#94A3B8;">Petra · ניהול עסקי חיות מחמד · <a href="https://petra-app.com" style="color:#F97316;text-decoration:none;">petra-app.com</a></p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`,
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

    // ── Downgrade cancel_pending businesses whose billing period has ended ───
    const toDowngrade = await prisma.business.findMany({
      where: {
        subscriptionStatus: "cancel_pending",
        subscriptionEndsAt: { lt: now },
      },
      select: { id: true, tier: true },
    });

    let downgraded = 0;
    for (const biz of toDowngrade) {
      try {
        await prisma.business.update({
          where: { id: biz.id },
          data: {
            tier:               "free",
            subscriptionStatus: "cancelled",
            subscriptionEndsAt: null,
          },
        });
        await prisma.subscriptionEvent.create({
          data: {
            businessId: biz.id,
            eventType:  "cancelled",
            tier:       biz.tier,
            metadata:   { cancelledAt: now.toISOString(), reason: "billing_period_ended" },
          },
        });
        downgraded++;
        console.log(`charge-trials: downgraded business ${biz.id} from ${biz.tier} to free`);
      } catch (err) {
        console.error(`charge-trials: error downgrading business ${biz.id}:`, err);
      }
    }

    if (downgraded > 0) {
      console.log(`charge-trials: downgraded ${downgraded} cancel_pending businesses`);
    }

    // Minimal response — internal counts logged to console only
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("charge-trials cron error:", error);
    return NextResponse.json({ error: "שגיאה בביצוע הcron" }, { status: 500 });
  }
}
