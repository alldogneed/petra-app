export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { isValidTier } from "@/lib/feature-flags";
import { encryptCardcomToken } from "@/lib/encryption";
import { createCardcomRecurring, getPlanPrice } from "@/lib/cardcom-recurring";
import { sendUpgradeConfirmationEmail } from "@/lib/email";

const TIER_DAYS: Record<string, number> = {
  basic: 30, pro: 30, groomer: 30, service_dog: 30,
};

/**
 * POST /api/cardcom/activate-pending
 *
 * Called by the success page after payment. Uses the stored
 * cardcomPendingCode to verify the payment and activate the subscription.
 * Authenticated — requires session cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { cardcomPendingCode: true, name: true, email: true, cardcomRecurringId: true },
    });

    if (!business?.cardcomPendingCode) {
      return NextResponse.json({ error: "אין תשלום ממתין" }, { status: 400 });
    }

    // Format: "lowProfileCode::tier" (tier stored alongside code)
    const parts = business.cardcomPendingCode.split("::");
    const lowProfileCode = parts[0];
    const storedTier = parts[1] ?? null;

    // ── Idempotency ──────────────────────────────────────────────────────
    const existing = await prisma.subscriptionEvent.findFirst({
      where: { lowprofileCode: lowProfileCode, eventType: "activate" },
      select: { id: true },
    });
    if (existing) {
      // Already activated — clear pending and return success
      await prisma.business.update({ where: { id: businessId }, data: { cardcomPendingCode: null } });
      return NextResponse.json({ ok: true, alreadyActivated: true });
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
      console.warn(`activate-pending: DealResponse=${data.DealResponse} for ${lowProfileCode}`);
      return NextResponse.json({ error: "התשלום לא אושר" }, { status: 400 });
    }

    // ── Get tier from stored pending code (Cardcom doesn't return UserId) ──
    const tier = storedTier;
    if (!tier || !isValidTier(tier)) {
      console.error(`activate-pending: invalid tier in pending code: ${business.cardcomPendingCode}`);
      return NextResponse.json({ error: "מסלול לא תקין" }, { status: 400 });
    }

    // ── Activate subscription ────────────────────────────────────────────
    const days = TIER_DAYS[tier] ?? 30;
    const subscriptionEndsAt = new Date(Date.now() + days * 86_400_000);

    await prisma.business.update({
      where: { id: businessId },
      data: {
        tier,
        subscriptionStatus: "active",
        subscriptionEndsAt,
        cardcomDealId: data.DealNumber ?? null,
        cardcomToken: data.Token ? encryptCardcomToken(data.Token) : null,
        cardcomPendingCode: null, // Clear pending
      },
    });

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

    console.log(`activate-pending: ${tier} activated for ${businessId}, deal ${data.DealNumber}`);

    // ── Send upgrade confirmation email (fire-and-forget) ────────────────
    const plan = getPlanPrice(tier);
    if (plan && business.email) {
      sendUpgradeConfirmationEmail({
        to: business.email,
        name: business.name ?? "",
        tierName: plan.label,
        tierPrice: plan.price,
      }).catch((e) => console.error("activate-pending: upgrade email failed:", e));
    }

    // ── Create recurring order (fire-and-forget) ─────────────────────────
    if (plan) {
      createCardcomRecurring({
        cardToken: data["ExtShvaParams.CardToken"] ?? "",
        cardMonth: (data.CardValidityMonth ?? "").trim(),
        cardYear: data.CardValidityYear ?? "",
        cardOwnerId: data.CardOwnerID ?? "",
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
          console.log(`activate-pending: recurring ${result.recurringId} for ${businessId}`);
        } else {
          console.error(`activate-pending: recurring failed for ${businessId}:`, result.error);
        }
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true, tier });
  } catch (error) {
    console.error("activate-pending error:", error);
    return NextResponse.json({ error: "שגיאה בהפעלת המנוי" }, { status: 500 });
  }
}
