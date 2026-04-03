export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { isValidTier } from "@/lib/feature-flags";
import { checkRateLimit } from "@/lib/security/rateLimiter";
import { ensureUserHasBusiness } from "@/lib/auth";
import { sendTrialWelcomeEmail } from "@/lib/email";
import { CURRENT_TOS_VERSION } from "@/lib/tos";
import { randomBytes, randomInt, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Generates a strong 12-character temp password (uppercase + digit + lowercase).
 *  Uses crypto.randomInt for unbiased index selection. */
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

  // Fisher-Yates shuffle using unbiased randomInt
  const arr = pass.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

// Only these tiers may be activated via the payment webhook
const BILLABLE_TIERS = new Set(["basic", "pro", "groomer", "service_dog"]);

const TIER_LABEL: Record<string, string> = {
  basic: "בייסיק", pro: "פרו", groomer: "גרומר+", service_dog: "Service Dog",
};
const TIER_PRICE: Record<string, number> = {
  basic: 99, pro: 199, groomer: 169, service_dog: 229,
};

/**
 * GET /api/cardcom/trial-indicator
 *
 * Cardcom calls this after a successful tokenisation (Operation=4, ₪0).
 * Handles two flows depending on the UserId:
 *
 *   A) "pending:{checkoutId}::{tier}" — checkout-first (new user):
 *      → Creates PlatformUser + Business, sends welcome email with temp password
 *
 *   B) "{businessId}::{tier}" — existing logged-in user:
 *      → Saves token + starts 14-day trial (unchanged from previous version)
 *
 * Same 5-layer security as /api/cardcom/indicator.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  try {
  const { searchParams } = new URL(request.url);

  // ── Layer 1: Secret validation (constant-time) ───────────────────────────
  const providedSecret = searchParams.get("secret") ?? "";
  const expectedSecret = process.env.CARDCOM_WEBHOOK_SECRET ?? "";
  const secretsMatch =
    providedSecret.length === expectedSecret.length &&
    expectedSecret.length > 0 &&
    timingSafeEqual(Buffer.from(providedSecret), Buffer.from(expectedSecret));
  if (!secretsMatch) {
    console.error(`trial-indicator [L1]: invalid secret from IP ${ip}`);
    await prisma.subscriptionEvent.create({
      data: { businessId: "unknown", eventType: "security_invalid_secret", ipAddress: ip, metadata: { path: "trial-indicator" } },
    }).catch(() => null);
    return new Response("Unauthorized", { status: 401 });
  }

  // ── Layer 2: Rate limiting ────────────────────────────────────────────────
  if (!checkRateLimit(ip, 10)) {
    console.warn(`trial-indicator [L2]: rate limit exceeded for IP ${ip}`);
    await prisma.subscriptionEvent.create({
      data: { businessId: "unknown", eventType: "security_rate_limit", ipAddress: ip, metadata: {} },
    }).catch(() => null);
    return new Response("Too Many Requests", { status: 429 });
  }

  const lowProfileCode = searchParams.get("lowprofilecode");
  if (!lowProfileCode) return new Response("Missing lowprofilecode", { status: 400 });

  // ── Layer 3: Idempotency ──────────────────────────────────────────────────
  const existing = await prisma.subscriptionEvent.findFirst({
    where: { lowprofileCode: lowProfileCode, eventType: "trial_started" },
    select: { id: true },
  });
  if (existing) {
    console.log(`trial-indicator [L3]: duplicate code ${lowProfileCode} — skipping`);
    return new Response("OK");
  }

  // ── Layer 4: Double-verify via Cardcom API ────────────────────────────────
  const verifyUrl = new URL("https://secure.cardcom.solutions/Interface/BillGoldGetLowProfileIndicator.aspx");
  verifyUrl.searchParams.set("terminalnumber", process.env.CARDCOM_TERMINAL_NUMBER ?? "");
  verifyUrl.searchParams.set("username",       process.env.CARDCOM_API_USERNAME ?? "");
  verifyUrl.searchParams.set("lowprofilecode", lowProfileCode);

  const verifyRes = await fetch(verifyUrl.toString());
  const verifyText = await verifyRes.text();

  const data: Record<string, string> = {};
  verifyText.split("&").forEach((pair) => {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) return;
    data[decodeURIComponent(pair.slice(0, eqIdx))] = decodeURIComponent(pair.slice(eqIdx + 1));
  });

  if (data.DealResponse !== "0") {
    console.warn(`trial-indicator [L4]: DealResponse=${data.DealResponse} for ${lowProfileCode}`);
    await prisma.subscriptionEvent.create({
      data: { businessId: "unknown", eventType: "security_deal_verify_failed", lowprofileCode: lowProfileCode, ipAddress: ip, metadata: { dealResponse: data.DealResponse ?? "N/A" } },
    }).catch(() => null);
    return new Response("OK");
  }

  // ── Decode UserId ─────────────────────────────────────────────────────────
  const rawUserId = data.UserId ?? "";
  const now = new Date();

  // ════════════════════════════════════════════════════════════════════
  //  FLOW A: Checkout-first — "pending:{checkoutId}::{tier}"
  // ════════════════════════════════════════════════════════════════════
  if (rawUserId.startsWith("pending:")) {
    const withoutPrefix = rawUserId.slice("pending:".length); // "{checkoutId}::{tier}"
    const colonIdx = withoutPrefix.indexOf("::");
    if (colonIdx === -1) {
      console.error(`trial-indicator [FlowA]: malformed UserId: ${rawUserId}`);
      return new Response("OK");
    }
    const checkoutId = withoutPrefix.slice(0, colonIdx);
    const tier       = withoutPrefix.slice(colonIdx + 2);

    if (!isValidTier(tier) || !BILLABLE_TIERS.has(tier)) {
      console.error(`trial-indicator [FlowA]: invalid/non-billable tier ${tier}`);
      return new Response("OK");
    }

    // Find PendingCheckout
    const checkout = await prisma.pendingCheckout.findUnique({ where: { id: checkoutId } });
    if (!checkout) {
      console.error(`trial-indicator [FlowA]: PendingCheckout ${checkoutId} not found`);
      return new Response("OK");
    }
    if (checkout.processed) {
      console.log(`trial-indicator [FlowA]: already processed ${checkoutId}`);
      return new Response("OK");
    }
    if (checkout.expiresAt < now) {
      console.warn(`trial-indicator [FlowA]: PendingCheckout ${checkoutId} expired`);
      return new Response("OK");
    }

    // Check email not already taken (edge case: user registered between form submit + webhook)
    const existingUser = await prisma.platformUser.findUnique({
      where: { email: checkout.email },
      select: { id: true },
    });
    if (existingUser) {
      console.warn(`trial-indicator [FlowA]: email ${checkout.email} already registered, skipping`);
      await prisma.pendingCheckout.update({ where: { id: checkoutId }, data: { processed: true, processedAt: now } });
      return new Response("OK");
    }

    // ── Create user account ───────────────────────────────────────────────
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

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
        ipAddress:    ip,   // Cardcom IP — best we have at this point
        userAgent:    "checkout-first",
      },
    }).catch(() => null);

    // Create Business + BusinessUser membership
    const businessId = await ensureUserHasBusiness(user.id, checkout.businessName || checkout.name);

    // Create OnboardingProgress
    await prisma.onboardingProgress.create({
      data: { userId: user.id, currentStep: 0 },
    }).catch(() => null);

    // ── Start 14-day trial ────────────────────────────────────────────────
    const trialEndsAt = new Date(now.getTime() + 14 * 86_400_000);

    await prisma.business.update({
      where: { id: businessId },
      data: {
        tier,
        trialEndsAt,
        cardcomToken:       data.Token ?? null,
        cardcomTokenExpiry: data.TokenExDate ?? null,
        cardcomDealId:      data.DealNumber ?? null,
        ...(checkout.phone        ? { phone:             checkout.phone }        : {}),
        ...(checkout.address      ? { address:           checkout.address }      : {}),
        ...(checkout.vatNumber    ? { vatNumber:         checkout.vatNumber }    : {}),
        ...(checkout.businessType ? { businessRegNumber: checkout.businessType } : {}),
      },
    });

    // ── Layer 5: Log events ───────────────────────────────────────────────
    await prisma.subscriptionEvent.create({
      data: {
        businessId,
        eventType:      "trial_started",
        tier,
        lowprofileCode: lowProfileCode,
        ipAddress:      ip,
        amount:         0,
        cardcomDealId:  data.DealNumber ?? null,
        metadata: {
          flow:         "checkout_first",
          userId:       user.id,
          email:        checkout.email,
          trialEndsAt:  trialEndsAt.toISOString(),
          hasToken:     !!data.Token,
        },
      },
    });

    await logAudit({
      actorUserId:  user.id,
      action:       AUDIT_ACTIONS.PLATFORM_USER_CREATED,
      targetType:   "PlatformUser",
      targetId:     user.id,
      metadata:     { email: user.email, name: user.name, method: "checkout_first" },
    });

    // Mark PendingCheckout as processed
    await prisma.pendingCheckout.update({
      where: { id: checkoutId },
      data:  { processed: true, processedAt: now },
    });

    // ── Send welcome email with temp credentials ──────────────────────────
    await sendTrialWelcomeEmail({
      to:           checkout.email,
      name:         checkout.name,
      tierName:     TIER_LABEL[tier] ?? tier,
      tierPrice:    TIER_PRICE[tier] ?? 0,
      tempPassword,
    }).catch((e) => console.error("trial-indicator: failed to send welcome email:", e));

    console.log(`trial-indicator [FlowA]: created user ${user.id} for ${checkout.email}, started ${tier} trial`);
    return new Response("OK");
  }

  // ════════════════════════════════════════════════════════════════════
  //  FLOW B: Existing logged-in user — "{businessId}::{tier}"
  // ════════════════════════════════════════════════════════════════════
  const [businessId, tier] = rawUserId.split("::");

  if (!businessId || !isValidTier(tier) || !BILLABLE_TIERS.has(tier)) {
    console.error(`trial-indicator [FlowB]: invalid/non-billable UserId: ${rawUserId}`);
    return new Response("OK");
  }

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
  if (!business) {
    console.error(`trial-indicator [FlowB]: business not found: ${businessId}`);
    return new Response("OK");
  }

  const trialEndsAt = new Date(now.getTime() + 14 * 86_400_000);

  await prisma.business.update({
    where: { id: businessId },
    data: {
      tier,
      trialEndsAt,
      cardcomToken:       data.Token ?? null,
      cardcomTokenExpiry: data.TokenExDate ?? null,
      cardcomDealId:      data.DealNumber ?? null,
    },
  });

  await prisma.subscriptionEvent.create({
    data: {
      businessId,
      eventType:      "trial_started",
      tier,
      cardcomDealId:  data.DealNumber ?? null,
      amount:         0,
      lowprofileCode: lowProfileCode,
      ipAddress:      ip,
      metadata: {
        flow:         "existing_user",
        trialEndsAt:  trialEndsAt.toISOString(),
        hasToken:     !!data.Token,
      },
    },
  });

  console.log(`trial-indicator [FlowB]: started ${tier} trial for business ${businessId}`);
  return new Response("OK");
  } catch (error) {
    console.error("trial-indicator: unhandled error:", error);
    return new Response("OK");
  }
}
