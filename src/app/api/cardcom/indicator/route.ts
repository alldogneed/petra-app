export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security/rateLimiter";
import { timingSafeEqual } from "crypto";
import { verifyIndicatorSignature, sanitizeUrlForLog } from "@/lib/security/cardcom-helpers";
import { extractDealId } from "@/lib/cardcom-recurring";
import { resolveBusinessForPayment, activateVerifiedPayment } from "@/lib/cardcom-activation";

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
 * The business is resolved from the pending code create-payment stored
 * (Cardcom does not return our UserId for immediate charges).
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  try {
  const { searchParams } = new URL(request.url);

  // ── Layer 1: Secret validation (HMAC signature or legacy secret) ────────
  const providedSig = searchParams.get("sig") ?? "";
  const providedSecret = searchParams.get("secret") ?? "";
  const expectedSecret = process.env.CARDCOM_WEBHOOK_SECRET ?? "";

  // If no webhook secret is configured, skip Layer 1 (Layer 4 Cardcom API
  // verification still protects against forged requests)
  const secretConfigured = expectedSecret.length > 0;

  if (secretConfigured) {
    const sigValid = providedSig ? verifyIndicatorSignature("/api/cardcom/indicator", providedSig) : false;
    const legacyValid = providedSecret.length > 0 &&
      providedSecret.length === expectedSecret.length &&
      timingSafeEqual(Buffer.from(providedSecret), Buffer.from(expectedSecret));

    if (!sigValid && !legacyValid) {
      console.error(`Cardcom indicator [Layer 1]: invalid secret from IP ${ip}`);
      await prisma.subscriptionEvent.create({
        data: {
          businessId: "unknown",
          eventType: "security_invalid_secret",
          ipAddress: ip,
          metadata: { path: sanitizeUrlForLog(request.url), ua: request.headers.get("user-agent") ?? "" },
        },
      }).catch(() => null);
      return new Response("Unauthorized", { status: 401 });
    }
  } else {
    console.error("Cardcom indicator [Layer 1]: CARDCOM_WEBHOOK_SECRET not configured — rejecting request");
    return new Response("Server misconfiguration", { status: 500 });
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
  if (!res.ok) {
    console.error(`Cardcom indicator [Layer 4]: HTTP ${res.status} from Cardcom API for code ${lowProfileCode}`);
    return new Response("Cardcom API verification failed", { status: 502 });
  }
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

  // ── Resolve business + tier ──────────────────────────────────────────────
  // Cardcom does not echo UserId back for Operation=1 charges, so this falls
  // back to the pending code create-payment stored on the business.
  const resolved = await resolveBusinessForPayment(data, lowProfileCode);
  if (!resolved) {
    console.error(`Cardcom indicator: cannot resolve business for code ${lowProfileCode} (UserId="${data.UserId ?? ""}")`);
    await prisma.subscriptionEvent.create({
      data: {
        businessId: "unknown",
        eventType: "activate_unresolved",
        lowprofileCode: lowProfileCode,
        ipAddress: ip,
        metadata: { path: "indicator", dealId: extractDealId(data) ?? "" },
      },
    }).catch(() => null);
    return new Response("OK");
  }

  await activateVerifiedPayment({
    businessId: resolved.businessId,
    tier: resolved.tier,
    lowProfileCode,
    data,
    source: "indicator",
    ipAddress: ip,
  });

  return new Response("OK");
  } catch (error) {
    console.error("Cardcom indicator: unhandled error:", error);
    // Always return OK to Cardcom to prevent retries on server errors
    return new Response("OK");
  }
}
