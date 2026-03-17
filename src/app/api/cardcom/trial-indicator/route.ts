export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isValidTier } from "@/lib/feature-flags";
import { checkRateLimit } from "@/lib/security/rateLimiter";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * GET /api/cardcom/trial-indicator
 *
 * Cardcom calls this after a successful tokenization (Operation=4).
 * Saves the card token and starts the 14-day free trial for the business.
 *
 * Same 5-layer security as /api/cardcom/indicator.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ip = getClientIp(request);

  // ── Layer 1: Secret validation ───────────────────────────────────────────
  if (searchParams.get("secret") !== process.env.CARDCOM_WEBHOOK_SECRET) {
    console.error(`trial-indicator [Layer 1]: invalid secret from IP ${ip}`);
    await prisma.subscriptionEvent.create({
      data: {
        businessId: "unknown",
        eventType: "security_invalid_secret",
        ipAddress: ip,
        metadata: { path: "trial-indicator", ua: request.headers.get("user-agent") ?? "" },
      },
    }).catch(() => null);
    return new Response("Unauthorized", { status: 401 });
  }

  // ── Layer 2: Rate limiting ────────────────────────────────────────────────
  if (!checkRateLimit(ip, 10)) {
    console.warn(`trial-indicator [Layer 2]: rate limit exceeded for IP ${ip}`);
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
    where: { lowprofileCode: lowProfileCode, eventType: "trial_started" },
    select: { id: true },
  });
  if (existing) {
    console.log(`trial-indicator [Layer 3]: duplicate lowprofileCode ${lowProfileCode} — skipping`);
    return new Response("OK");
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

  // For tokenization (Operation=4), Cardcom may return DealResponse=0 even with SumToBill=0
  if (data.DealResponse !== "0") {
    console.warn(`trial-indicator [Layer 4]: DealResponse not 0 (${data.DealResponse}) for code ${lowProfileCode}`);
    await prisma.subscriptionEvent.create({
      data: {
        businessId: "unknown",
        eventType: "security_deal_verify_failed",
        lowprofileCode: lowProfileCode,
        ipAddress: ip,
        metadata: { dealResponse: data.DealResponse ?? "N/A" },
      },
    }).catch(() => null);
    return new Response("OK");
  }

  // ── Decode businessId + tier from UserId ─────────────────────────────────
  const rawUserId = data.UserId ?? "";
  const [businessId, tier] = rawUserId.split("::");

  if (!businessId || !isValidTier(tier)) {
    console.error(`trial-indicator: invalid UserId format: ${rawUserId}`);
    return new Response("OK");
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });
  if (!business) {
    console.error(`trial-indicator: business not found: ${businessId}`);
    return new Response("OK");
  }

  // ── Start 14-day trial ────────────────────────────────────────────────────
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 14 * 86_400_000);

  await prisma.business.update({
    where: { id: businessId },
    data: {
      tier,
      trialEndsAt,
      cardcomToken:        data.Token ?? null,
      cardcomTokenExpiry:  data.TokenExDate ?? null,   // MMYY card expiry
      cardcomDealId:       data.DealNumber ?? null,
    },
  });

  // ── Layer 5: Log the trial start event ───────────────────────────────────
  await prisma.subscriptionEvent.create({
    data: {
      businessId,
      eventType:      "trial_started",
      tier,
      cardcomDealId:  data.DealNumber ?? null,
      amount:         0,
      lowprofileCode: lowProfileCode,
      ipAddress:      ip,
      metadata:       { trialEndsAt: trialEndsAt.toISOString(), hasToken: !!data.Token },
    },
  });

  console.log(`trial-indicator: started ${tier} trial for business ${businessId}, ends ${trialEndsAt.toISOString()}`);
  return new Response("OK");
}
