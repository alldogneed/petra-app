export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isValidTier } from "@/lib/feature-flags";

const TIER_DAYS: Record<string, number> = {
  basic: 30, pro: 30, groomer: 30, service_dog: 30,
};

/**
 * GET /api/cardcom/indicator
 *
 * Cardcom calls this URL after a successful payment (server-to-server).
 * Auth: webhook secret in query param (no session auth — Cardcom is the caller).
 *
 * Query params from Cardcom:
 *   secret        — our CARDCOM_WEBHOOK_SECRET
 *   lowprofilecode — the LowProfile transaction code
 *   (others from Cardcom indicator response)
 *
 * UserId we sent encodes: "{businessId}::{tier}"
 * Cardcom returns it as-is in the indicator.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // 1. Verify secret
  if (searchParams.get("secret") !== process.env.CARDCOM_WEBHOOK_SECRET) {
    console.error("Cardcom indicator: invalid secret");
    return new Response("Unauthorized", { status: 401 });
  }

  const lowProfileCode = searchParams.get("lowprofilecode");
  if (!lowProfileCode) {
    return new Response("Missing lowprofilecode", { status: 400 });
  }

  // 2. Fetch deal details from Cardcom
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

  // 3. Only proceed on successful deal
  if (data.DealResponse !== "0") {
    console.warn("Cardcom indicator: DealResponse not 0:", data);
    return new Response("OK"); // Always return OK to Cardcom
  }

  // 4. Decode businessId + tier from UserId field
  const rawUserId = data.UserId ?? "";
  const [businessId, tier] = rawUserId.split("::");

  if (!businessId || !isValidTier(tier)) {
    console.error("Cardcom indicator: invalid UserId format:", rawUserId);
    return new Response("OK");
  }

  // 5. Verify the business exists
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });
  if (!business) {
    console.error("Cardcom indicator: business not found:", businessId);
    return new Response("OK");
  }

  // 6. Update Business subscription
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

  // 7. Log the event
  await prisma.subscriptionEvent.create({
    data: {
      businessId,
      eventType:    "activate",
      tier,
      cardcomDealId: data.DealNumber ?? null,
      amount:        parseFloat(data.SumToBill ?? "0") || null,
      metadata:      data as object,
    },
  });

  console.log(`Cardcom: activated ${tier} for business ${businessId}, deal ${data.DealNumber}`);
  return new Response("OK");
}
