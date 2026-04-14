export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isValidTier } from "@/lib/feature-flags";
import { encryptCardcomToken } from "@/lib/encryption";
import { createCardcomRecurring, getPlanPrice } from "@/lib/cardcom-recurring";
import { ensureUserHasBusiness } from "@/lib/auth";
import { sendCheckoutWelcomeEmail, sendUpgradeConfirmationEmail } from "@/lib/email";
import { CURRENT_TOS_VERSION } from "@/lib/tos";
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";

const TIER_DAYS: Record<string, number> = {
  basic: 30, pro: 30, groomer: 30, service_dog: 30,
};

const TIER_LABEL: Record<string, string> = {
  basic: "בייסיק", pro: "פרו",
};
const TIER_PRICE: Record<string, number> = {
  basic: 99, pro: 199,
};

// Only basic and pro may be activated via checkout-first
const BILLABLE_TIERS = new Set(["basic", "pro"]);

/** Generates a strong 12-character temp password. */
function generateTempPassword(): string {
  const upper  = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower  = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const all    = upper + lower + digits;

  let pass = "";
  pass += upper[randomInt(upper.length)];
  pass += lower[randomInt(lower.length)];
  pass += digits[randomInt(digits.length)];
  for (let i = 3; i < 12; i++) pass += all[randomInt(all.length)];

  const arr = pass.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

/** Parse Cardcom key=value response */
function parseCardcomKV(text: string): Record<string, string> {
  const data: Record<string, string> = {};
  text.split("&").forEach((pair) => {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) return;
    data[decodeURIComponent(pair.slice(0, eqIdx))] = decodeURIComponent(pair.slice(eqIdx + 1));
  });
  return data;
}

/** Verify payment via Cardcom API. Returns parsed response or null on failure. */
async function verifyCardcomPayment(lowProfileCode: string): Promise<Record<string, string> | null> {
  const verifyUrl = new URL(
    "https://secure.cardcom.solutions/Interface/BillGoldGetLowProfileIndicator.aspx"
  );
  verifyUrl.searchParams.set("terminalnumber", process.env.CARDCOM_TERMINAL_NUMBER ?? "");
  verifyUrl.searchParams.set("username", process.env.CARDCOM_API_USERNAME ?? "");
  verifyUrl.searchParams.set("lowprofilecode", lowProfileCode);

  const res = await fetch(verifyUrl.toString());
  const text = await res.text();
  const data = parseCardcomKV(text);

  if (data.DealResponse !== "0") {
    return null;
  }
  return data;
}

/** Fire-and-forget: create recurring order in Cardcom and save recurringId */
function createRecurringForBusiness(
  data: Record<string, string>,
  tier: string,
  businessId: string,
  businessName: string,
  email: string,
  existingRecurringId?: string,
) {
  const plan = getPlanPrice(tier);
  if (!plan) return;
  createCardcomRecurring({
    cardToken: data["ExtShvaParams.CardToken"] ?? "",
    cardMonth: (data.CardValidityMonth ?? "").trim(),
    cardYear: data.CardValidityYear ?? "",
    cardOwnerId: data.CardOwnerID ?? "",
    price: plan.price,
    invoiceDescription: `מנוי ${plan.label} — חודשי`,
    companyName: businessName || "לקוח פטרה",
    email: email || "",
    existingRecurringId,
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

/**
 * GET /api/cardcom/success-redirect
 *
 * Cardcom redirects the user here after successful payment (via GoodURL).
 * Handles two flows:
 *
 *   A) checkoutId param → checkout-first (new user):
 *      Reads PendingCheckout, verifies stored lowProfileCode, creates user + business,
 *      activates subscription, sends welcome email, redirects to success page.
 *
 *   B) lowprofilecode param → existing logged-in user:
 *      Verifies payment, decodes businessId from UserId, activates subscription,
 *      redirects to success page. Falls back to activate-pending on success page.
 *
 * This replaces the unreliable server-to-server IndicatorURL callback.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const checkoutId = searchParams.get("checkoutId") ?? "";
  const lowProfileCode = searchParams.get("lowprofilecode") ?? searchParams.get("LowProfileCode") ?? "";
  const tierParam = searchParams.get("tier") ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://petra-app.com";

  // ════════════════════════════════════════════════════════════════════
  //  FLOW A: Checkout-first (new user) — checkoutId in URL
  // ════════════════════════════════════════════════════════════════════
  if (checkoutId) {
    try {
      const checkout = await prisma.pendingCheckout.findUnique({ where: { id: checkoutId } });
      if (!checkout) {
        console.error(`success-redirect [FlowA]: PendingCheckout ${checkoutId} not found`);
        return NextResponse.redirect(`${appUrl}/payment/error`);
      }
      if (checkout.processed) {
        // Already processed — redirect to success with login hint
        return NextResponse.redirect(`${appUrl}/payment/success?tier=${checkout.tier}&newuser=1`);
      }
      const now = new Date();
      if (checkout.expiresAt < now) {
        console.warn(`success-redirect [FlowA]: PendingCheckout ${checkoutId} expired`);
        return NextResponse.redirect(`${appUrl}/payment/error`);
      }

      const tier = checkout.tier;
      if (!isValidTier(tier) || !BILLABLE_TIERS.has(tier)) {
        console.error(`success-redirect [FlowA]: invalid/non-billable tier ${tier}`);
        return NextResponse.redirect(`${appUrl}/payment/error`);
      }

      // Get lowProfileCode from PendingCheckout record
      const lpCode = checkout.lowProfileCode;
      if (!lpCode) {
        console.error(`success-redirect [FlowA]: no lowProfileCode on PendingCheckout ${checkoutId}`);
        return NextResponse.redirect(`${appUrl}/payment/error`);
      }

      // ── Idempotency ──────────────────────────────────────────────────
      const existing = await prisma.subscriptionEvent.findFirst({
        where: { lowprofileCode: lpCode, eventType: "checkout_activate" },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.redirect(`${appUrl}/payment/success?tier=${tier}&newuser=1`);
      }

      // ── Verify payment via Cardcom API ───────────────────────────────
      const data = await verifyCardcomPayment(lpCode);
      if (!data) {
        console.warn(`success-redirect [FlowA]: payment verification failed for ${lpCode}`);
        return NextResponse.redirect(`${appUrl}/payment/error`);
      }

      // ── Check email not already taken ────────────────────────────────
      const existingUser = await prisma.platformUser.findUnique({
        where: { email: checkout.email },
        select: { id: true },
      });
      if (existingUser) {
        console.warn(`success-redirect [FlowA]: email ${checkout.email} already registered`);
        await prisma.pendingCheckout.update({ where: { id: checkoutId }, data: { processed: true, processedAt: now } });
        return NextResponse.redirect(`${appUrl}/payment/success?tier=${tier}&newuser=1`);
      }

      // ── Create user account ──────────────────────────────────────────
      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

      const user = await prisma.platformUser.create({
        data: {
          name:           checkout.name,
          email:          checkout.email,
          passwordHash,
          platformRole:   null,
          isActive:       true,
          tosAcceptedVersion: CURRENT_TOS_VERSION,
          tosAcceptedAt:  now,
        },
      });

      // Record TOS consent
      await prisma.userConsent.create({
        data: {
          id:           `${user.id}:${CURRENT_TOS_VERSION}`,
          userId:       user.id,
          termsVersion: CURRENT_TOS_VERSION,
          ipAddress:    ip,
          userAgent:    "checkout-first-redirect",
        },
      }).catch(() => null);

      // Create Business + BusinessUser membership
      const businessId = await ensureUserHasBusiness(user.id, checkout.businessName || checkout.name);

      // Create OnboardingProgress
      await prisma.onboardingProgress.create({
        data: { userId: user.id, currentStep: 0 },
      }).catch(() => null);

      // ── Activate subscription (30-day period) ────────────────────────
      const days = TIER_DAYS[tier] ?? 30;
      const subscriptionEndsAt = new Date(now.getTime() + days * 86_400_000);

      await prisma.business.update({
        where: { id: businessId },
        data: {
          tier,
          subscriptionStatus:  "active",
          subscriptionEndsAt,
          cardcomToken:        data.Token ? encryptCardcomToken(data.Token) : null,
          cardcomTokenExpiry:  data.TokenExDate ? encryptCardcomToken(data.TokenExDate) : null,
          cardcomDealId:       data.DealNumber ?? null,
          ...(checkout.phone        ? { phone:             checkout.phone }        : {}),
          ...(checkout.address      ? { address:           checkout.address }      : {}),
          ...(checkout.vatNumber    ? { vatNumber:         checkout.vatNumber }    : {}),
          ...(checkout.businessType ? { businessRegNumber: checkout.businessType } : {}),
        },
      });

      // ── Log activation event ─────────────────────────────────────────
      await prisma.subscriptionEvent.create({
        data: {
          businessId,
          eventType:      "checkout_activate",
          tier,
          lowprofileCode: lpCode,
          ipAddress:      ip,
          amount:         TIER_PRICE[tier] ?? 0,
          cardcomDealId:  data.DealNumber ?? null,
          metadata: {
            flow:                "checkout_first_redirect",
            userId:              user.id,
            email:               checkout.email,
            subscriptionEndsAt:  subscriptionEndsAt.toISOString(),
            hasToken:            !!data.Token,
          },
        },
      });

      await logAudit({
        actorUserId:  user.id,
        action:       AUDIT_ACTIONS.PLATFORM_USER_CREATED,
        targetType:   "PlatformUser",
        targetId:     user.id,
        metadata:     { email: user.email, name: user.name, method: "checkout_first_redirect" },
      });

      // Mark PendingCheckout as processed
      await prisma.pendingCheckout.update({
        where: { id: checkoutId },
        data:  { processed: true, processedAt: now },
      });

      // ── Create recurring order (fire-and-forget) ─────────────────────
      createRecurringForBusiness(
        data, tier, businessId,
        checkout.businessName || checkout.name,
        checkout.billingEmail || checkout.email,
      );

      // ── Send welcome email with temp credentials ─────────────────────
      sendCheckoutWelcomeEmail({
        to:           checkout.email,
        name:         checkout.name,
        tierName:     TIER_LABEL[tier] ?? tier,
        tierPrice:    TIER_PRICE[tier] ?? 0,
        tempPassword,
      }).catch((e) => console.error("success-redirect [FlowA]: failed to send welcome email:", e));

      console.log(`success-redirect [FlowA]: created user ${user.id} for ${checkout.email}, activated ${tier}`);
      return NextResponse.redirect(`${appUrl}/payment/success?tier=${tier}&newuser=1`);
    } catch (error) {
      console.error("success-redirect [FlowA] error:", error);
      return NextResponse.redirect(`${appUrl}/payment/error`);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  FLOW B: Existing logged-in user — lowprofilecode from Cardcom redirect
  // ════════════════════════════════════════════════════════════════════

  // If no lowprofilecode, just redirect to success page (activate-pending will handle it)
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
      return NextResponse.redirect(`${appUrl}/payment/success?tier=${tierParam}`);
    }

    // ── Verify payment via Cardcom API ───────────────────────────────────
    const data = await verifyCardcomPayment(lowProfileCode);
    if (!data) {
      console.warn(`success-redirect [FlowB]: payment verification failed for ${lowProfileCode}`);
      // Don't show error — activate-pending on the success page will retry
      return NextResponse.redirect(`${appUrl}/payment/success?tier=${tierParam}`);
    }

    // ── Decode businessId + tier from UserId ─────────────────────────────
    const rawUserId = data.UserId ?? "";
    const [businessId, tier] = rawUserId.split("::");

    if (!businessId || !isValidTier(tier)) {
      // UserId may not be available from verification — fall through to activate-pending
      console.warn(`success-redirect [FlowB]: invalid UserId: ${rawUserId}, falling through`);
      return NextResponse.redirect(`${appUrl}/payment/success?tier=${tierParam}`);
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, email: true, cardcomRecurringId: true },
    });
    if (!business) {
      console.error(`success-redirect [FlowB]: business not found: ${businessId}`);
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
        cardcomPendingCode: null, // Clear pending code
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

    console.log(`success-redirect [FlowB]: activated ${tier} for business ${businessId}, deal ${data.DealNumber}`);

    // ── Send upgrade confirmation email (fire-and-forget) ────────────────
    const plan = getPlanPrice(tier);
    if (plan && business.email) {
      sendUpgradeConfirmationEmail({
        to: business.email,
        name: business.name ?? "",
        tierName: plan.label,
        tierPrice: plan.price,
      }).catch((e) => console.error("success-redirect [FlowB]: upgrade email failed:", e));
    }

    // ── Create recurring order (fire-and-forget) ─────────────────────────
    createRecurringForBusiness(
      data, tier, businessId,
      business.name ?? "לקוח פטרה",
      business.email ?? "",
      business.cardcomRecurringId ?? undefined,
    );

    return NextResponse.redirect(`${appUrl}/payment/success?tier=${tier}`);
  } catch (error) {
    console.error("success-redirect [FlowB] error:", error);
    return NextResponse.redirect(`${appUrl}/payment/success?tier=${tierParam}`);
  }
}
