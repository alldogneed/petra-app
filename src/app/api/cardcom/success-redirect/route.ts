export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isValidTier } from "@/lib/feature-flags";
import { encryptCardcomToken } from "@/lib/encryption";
import { createCardcomRecurring, getPlanPrice } from "@/lib/cardcom-recurring";

const TIER_DAYS: Record<string, number> = {
  basic: 30, pro: 30, groomer: 30, service_dog: 30,
};

/**
 * GET /api/cardcom/success-redirect
 *
 * Cardcom redirects the user here after successful payment (via GoodURL).
 * This route:
 *   1. Verifies the payment via Cardcom API (same as indicator Layer 4)
 *   2. Activates the subscription
 *   3. Creates recurring order (הוראת קבע)
 *   4. Redirects user to /payment/success
 *
 * This replaces the unreliable server-to-server IndicatorURL callback.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lowProfileCode = searchParams.get("lowprofilecode") ?? searchParams.get("LowProfileCode") ?? "";
  const tierParam = searchParams.get("tier") ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://petra-app.com";

  // If no lowprofilecode, just redirect to success page
  if (!lowProfileCode) {
    return NextResponse.redirect(`${appUrl}/payment/success?tier=${tierParam}`);
  }

  try {
    // ── Idempotency check ────────────────────────────────────────────────
    const existing = await prisma.subscriptionEvent.findFirst({
      where: { lowprofileCode: lowProfileCode, eventType: "activate" },
      select: { id: true },
    });
    if (existing) {
      // Already processed — just redirect
      return NextResponse.redirect(`${appUrl}/payment/success?tier=${tierParam}`);
    }

    // ── Verify payment via Cardcom API ───────────────────────────────────
    const verifyUrl = new URL(
      "https://secure.cardcom.solutions/Interface/BillGoldGetLowProfileIndicator.aspx"
    );
    verifyUrl.searchParams.set("terminalnumber", process.env.CARDCOM_TERMINAL_NUMBER ?? "");
    verifyUrl.searchParams.set("username", process.env.CARDCOM_API_USERNAME ?? "");
    verifyUrl.searchParams.set("lowprofilecode", lowProfileCode);

    const res = await fetch(verifyUrl.toString());
    const text = await res.text();

    const data: Record<string, string> = {};
    text.split("&").forEach((pair) => {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) return;
      data[decodeURIComponent(pair.slice(0, eqIdx))] = decodeURIComponent(pair.slice(eqIdx + 1));
    });

    if (data.DealResponse !== "0") {
      console.warn(`success-redirect: DealResponse=${data.DealResponse} for code ${lowProfileCode}`);
      return NextResponse.redirect(`${appUrl}/payment/error`);
    }

    // ── Decode businessId + tier from UserId ─────────────────────────────
    const rawUserId = data.UserId ?? "";
    const [businessId, tier] = rawUserId.split("::");

    if (!businessId || !isValidTier(tier)) {
      console.error(`success-redirect: invalid UserId: ${rawUserId}`);
      return NextResponse.redirect(`${appUrl}/payment/success?tier=${tierParam}`);
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, email: true, cardcomRecurringId: true },
    });
    if (!business) {
      console.error(`success-redirect: business not found: ${businessId}`);
      return NextResponse.redirect(`${appUrl}/payment/success?tier=${tierParam}`);
    }

    // ── Activate subscription ────────────────────────────────────────────
    const days = TIER_DAYS[tier] ?? 30;
    const now = new Date();
    const subscriptionEndsAt = new Date(now.getTime() + days * 86_400_000);

    await prisma.business.update({
      where: { id: businessId },
      data: {
        tier,
        subscriptionStatus: "active",
        subscriptionEndsAt,
        cardcomDealId: data.DealNumber ?? null,
        cardcomToken: data.Token ? encryptCardcomToken(data.Token) : null,
      },
    });

    // ── Log activation event ─────────────────────────────────────────────
    await prisma.subscriptionEvent.create({
      data: {
        businessId,
        eventType: "activate",
        tier,
        cardcomDealId: data.DealNumber ?? null,
        amount: parseFloat(data.SumToBill ?? "0") || null,
        lowprofileCode: lowProfileCode,
        metadata: data as object,
      },
    });

    console.log(`success-redirect: activated ${tier} for business ${businessId}, deal ${data.DealNumber}`);

    // ── Create recurring order (fire-and-forget) ─────────────────────────
    const plan = getPlanPrice(tier);
    if (plan) {
      createCardcomRecurring({
        lowProfileDealGuid: lowProfileCode,
        price: plan.price,
        invoiceDescription: `מנוי ${plan.label} — חודשי`,
        companyName: business.name ?? "לקוח פטרה",
        email: business.email ?? "",
        existingRecurringId: business.cardcomRecurringId ?? undefined,
      }).then(async (result) => {
        if (result.success && result.recurringId) {
          await prisma.business.update({
            where: { id: businessId },
            data: { cardcomRecurringId: result.recurringId },
          });
          console.log(`success-redirect: recurring ${result.recurringId} created for ${businessId}`);
        } else {
          console.error(`success-redirect: recurring failed for ${businessId}:`, result.error);
        }
      }).catch(() => null);
    }

    return NextResponse.redirect(`${appUrl}/payment/success?tier=${tier}`);
  } catch (error) {
    console.error("success-redirect error:", error);
    return NextResponse.redirect(`${appUrl}/payment/success?tier=${tierParam}`);
  }
}
