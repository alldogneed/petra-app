export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security/rateLimiter";
import { verifyIndicatorSignature } from "@/lib/security/cardcom-helpers";
import { verifyLowProfile } from "@/lib/cardcom-activation";
import { applyCardUpdate, resolveCardUpdateBusiness, CARD_UPDATE_INDICATOR } from "@/lib/cardcom-card-update";

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * GET /api/cardcom/card-update-indicator — Cardcom calls this after a ₪0
 * CreateTokenOnly session opened by /api/cardcom/update-card.
 * Layers: HMAC sig → rate limit → re-verify with Cardcom (never trust the query)
 * → business from UserId "{businessId}::cardupdate" (or the card_update_started
 * event) → applyCardUpdate (idempotent per lowprofilecode). Always answers OK
 * after the signature check so Cardcom doesn't retry a request we already handled.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  try {
    const { searchParams } = new URL(request.url);
    if (!verifyIndicatorSignature(CARD_UPDATE_INDICATOR, searchParams.get("sig") ?? "")) {
      await prisma.subscriptionEvent.create({
        data: { businessId: "unknown", eventType: "security_invalid_secret", ipAddress: ip, metadata: { path: "card-update-indicator" } },
      }).catch(() => null);
      return new Response("Unauthorized", { status: 401 });
    }
    if (!checkRateLimit(ip, 10)) return new Response("Too Many Requests", { status: 429 });

    const lowProfileCode = searchParams.get("lowprofilecode");
    if (!lowProfileCode || lowProfileCode.length > 100) return new Response("Missing lowprofilecode", { status: 400 });

    const verified = await verifyLowProfile(lowProfileCode);
    if (!verified.ok) {
      console.warn(`card-update-indicator: not verified ${lowProfileCode}: ${verified.responseCode}/${verified.dealResponse}`);
      return new Response("OK");
    }

    const businessId = await resolveCardUpdateBusiness(verified.data, lowProfileCode);
    if (!businessId) {
      console.error(`card-update-indicator: no business for ${lowProfileCode}`);
      return new Response("OK");
    }

    const outcome = await applyCardUpdate({ businessId, lowProfileCode, data: verified.data, ipAddress: ip });
    console.log(`card-update-indicator: ${businessId} → ${outcome.status}`);
    return new Response("OK");
  } catch (error) {
    console.error("card-update-indicator: unhandled error:", error);
    return new Response("Server error", { status: 500 });
  }
}
