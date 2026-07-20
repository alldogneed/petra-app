export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { scheduleBoardingCheckoutReminder } from "@/lib/reminder-service";
import { syncBoardingToGcal } from "@/lib/google-calendar";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { toWhatsAppPhone } from "@/lib/utils";
import { hasFeatureWithOverrides } from "@/lib/feature-flags";
import { listBoardingStays, createBoardingStay, ServiceError } from "@/services/boarding";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const stays = await listBoardingStays(authResult.businessId, prisma, {
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
    });

    return NextResponse.json(stays);
  } catch (error) {
    console.error("Error fetching boarding stays:", error);
    return NextResponse.json({ error: "Failed to fetch boarding stays" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:boarding:write", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות" }, { status: 429 });

    const bizForTier = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { tier: true, featureOverrides: true },
    });
    const tierOverrides = (bizForTier?.featureOverrides as Record<string, boolean> | null) ?? null;
    const boardingEnabled = hasFeatureWithOverrides(bizForTier?.tier ?? "free", "boarding", tierOverrides);

    const body = await request.json();
    let stay;
    try {
      stay = await createBoardingStay(authResult.businessId, prisma, body, { boardingEnabled });
    } catch (e) {
      if (e instanceof ServiceError) {
        const status = e.code === "NOT_FOUND" ? 404 : e.code === "CONFLICT" ? 409 : e.code === "UNAUTHORIZED" ? 403 : 400;
        return NextResponse.json({ error: e.message }, { status });
      }
      throw e;
    }

    logCurrentUserActivity("CREATE_BOARDING_STAY");

    // WhatsApp booking confirmation (PRO+ only, fire-and-forget).
    // Sends only when ALL hold: the business tier allows it, the master
    // "שליחת הודעות אוטומטיות" toggle (whatsappRemindersEnabled) is on, AND the
    // per-message "boarding_confirmation" automation is active. Previously this sent
    // on tier alone, so customers got boarding confirmations even when automatic
    // messages — or this specific automation — were turned off.
    const bizForWa = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { tier: true, featureOverrides: true, whatsappRemindersEnabled: true },
    });
    const waOverrides = (bizForWa?.featureOverrides as Record<string, boolean> | null) ?? null;
    if (
      bizForWa?.whatsappRemindersEnabled &&
      hasFeatureWithOverrides(bizForWa?.tier ?? "free", "whatsapp_reminders", waOverrides) &&
      stay.customer?.phone
    ) {
      const confirmRule = await prisma.automationRule.findFirst({
        where: { businessId: authResult.businessId, trigger: "boarding_confirmation", isActive: true },
        select: { id: true },
      });
      const phone = confirmRule ? toWhatsAppPhone(stay.customer.phone) : null;
      if (phone) {
        const checkInStr = stay.checkIn.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
        const checkOutStr = stay.checkOut
          ? stay.checkOut.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })
          : "טרם נקבע";
        await sendWhatsAppTemplate({
          to: phone,
          templateName: "petra_boarding_confirmation",
          bodyParams: [stay.customer.name, stay.pet.name, checkInStr, checkOutStr],
        }).catch((err) => console.error("Boarding confirmation WA failed:", err));
      }
    }

    if (stay.checkOut && stay.customerId) {
      await scheduleBoardingCheckoutReminder({
        id: stay.id,
        businessId: authResult.businessId,
        customerId: stay.customerId,
        checkOut: stay.checkOut,
        pet: { name: stay.pet.name },
        customer: { name: stay.customer?.name ?? stay.pet.name },
      }).catch(console.error);
    }

    await syncBoardingToGcal(stay.id, authResult.businessId).catch((err) =>
      console.error("Failed to sync boarding to GCal:", err)
    );

    return NextResponse.json(stay, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    console.error("Error creating boarding stay:", error);
    return NextResponse.json({ error: "Failed to create boarding stay" }, { status: 500 });
  }
}
