export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isValidTier } from "@/lib/feature-flags";
import { checkRateLimit } from "@/lib/security/rateLimiter";

const TIER_DAYS: Record<string, number> = {
  basic: 30, pro: 30, groomer: 30, service_dog: 30,
};

/** Extract real client IP from request headers. */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * GET /api/cardcom/indicator
 *
 * Cardcom calls this URL after a successful payment (server-to-server).
 * Auth: webhook secret in query param (no session auth — Cardcom is the caller).
 *
 * Security layers:
 *   1. Secret validation
 *   2. Rate limiting (10 req/min per IP)
 *   3. Idempotency (lowprofileCode dedup)
 *   4. Double-verify via Cardcom API
 *   5. Security event logging for all failures
 *
 * UserId we sent encodes: "{businessId}::{tier}"
 * Cardcom returns it as-is in the indicator.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ip = getClientIp(request);

  // ── Layer 1: Secret validation ───────────────────────────────────────────
  if (searchParams.get("secret") !== process.env.CARDCOM_WEBHOOK_SECRET) {
    console.error(`Cardcom indicator [Layer 1]: invalid secret from IP ${ip}`);
    // Log security event (best-effort — no businessId yet)
    await prisma.subscriptionEvent.create({
      data: {
        businessId: "unknown",
        eventType: "security_invalid_secret",
        ipAddress: ip,
        metadata: { path: request.url, ua: request.headers.get("user-agent") ?? "" },
      },
    }).catch(() => null); // don't let logging failure break the response
    return new Response("Unauthorized", { status: 401 });
  }

  // ── Layer 2: Rate limiting ────────────────────────────────────────────────
  if (!checkRateLimit(ip, 10)) {
    console.warn(`Cardcom indicator [Layer 2]: rate limit exceeded for IP ${ip}`);
    await prisma.subscriptionEvent.create({
      data: {
        businessId: "unknown",
        eventType: "security_rate_limit",
        ipAddress: ip,
        metadata: {},
      },
    }).catch(() => null);
    return new Response("Too Many Requests", { status: 429 });
  }

  const lowProfileCode = searchParams.get("lowprofilecode");
  if (!lowProfileCode) {
    return new Response("Missing lowprofilecode", { status: 400 });
  }

  // ── Layer 3: Idempotency — skip duplicate events ─────────────────────────
  const existing = await prisma.subscriptionEvent.findFirst({
    where: { lowprofileCode: lowProfileCode, eventType: "activate" },
    select: { id: true },
  });
  if (existing) {
    console.log(`Cardcom indicator [Layer 3]: duplicate lowprofileCode ${lowProfileCode} — skipping`);
    return new Response("OK"); // already processed — idempotent response
  }

  // ── Layer 4: Double-verify via Cardcom API ────────────────────────────────
  const indicatorUrl = new URL(
    "https://secure.cardcom.solutions/Interface/BillGoldGetLowProfileIndicator.aspx"
  );
  indicatorUrl.searchParams.set("terminalnumber", process.env.CARDCOM_TERMINAL_NUMBER ?? "");
  indicatorUrl.searchParams.set("username", process.env.CARDCOM_API_USERNAME ?? "");
  indicatorUrl.searchParams.set("lowprofilecode", lowProfileCode);

  const res = await fetch(indicatorUrl.toString());
  const text = await res.text();

  const data: Record<string, string> = {};
  text.split("&").forEach((pair) => {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) return;
    const k = decodeURIComponent(pair.slice(0, eqIdx));
    const v = decodeURIComponent(pair.slice(eqIdx + 1));
    data[k] = v;
  });

  if (data.DealResponse !== "0") {
    console.warn(`Cardcom indicator [Layer 4]: DealResponse not 0 (${data.DealResponse}) for code ${lowProfileCode}`);
    await prisma.subscriptionEvent.create({
      data: {
        businessId: "unknown",
        eventType: "security_deal_verify_failed",
        lowprofileCode: lowProfileCode,
        ipAddress: ip,
        metadata: { dealResponse: data.DealResponse ?? "N/A" },
      },
    }).catch(() => null);
    return new Response("OK"); // Always return OK to Cardcom even on failure
  }

  // ── Decode businessId + tier from UserId ─────────────────────────────────
  const rawUserId = data.UserId ?? "";
  const [businessId, tier] = rawUserId.split("::");

  if (!businessId || !isValidTier(tier)) {
    console.error(`Cardcom indicator: invalid UserId format: ${rawUserId}`);
    return new Response("OK");
  }

  // Verify the business exists
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });
  if (!business) {
    console.error(`Cardcom indicator: business not found: ${businessId}`);
    return new Response("OK");
  }

  // ── Activate subscription ─────────────────────────────────────────────────
  const days = TIER_DAYS[tier] ?? 30;
  const now = new Date();
  const subscriptionEndsAt = new Date(now.getTime() + days * 86_400_000);

  await prisma.business.update({
    where: { id: businessId },
    data: {
      tier,
      subscriptionStatus:  "active",
      subscriptionEndsAt,
      cardcomDealId:       data.DealNumber ?? null,
      cardcomToken:        data.Token ?? null,
    },
  });

  // ── Layer 5: Log the activation event (with idempotency key + IP) ─────────
  await prisma.subscriptionEvent.create({
    data: {
      businessId,
      eventType:      "activate",
      tier,
      cardcomDealId:  data.DealNumber ?? null,
      amount:         parseFloat(data.SumToBill ?? "0") || null,
      lowprofileCode: lowProfileCode,
      ipAddress:      ip,
      metadata:       data as object,
    },
  });

  console.log(`Cardcom: activated ${tier} for business ${businessId}, deal ${data.DealNumber}`);
  return new Response("OK");
}
