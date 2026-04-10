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

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { businessId: authResult.businessId };

    // Optional date range filter for calendar/timeline
    if (from && to) {
      where.checkIn = { lte: new Date(to + "T23:59:59") };
      where.OR = [
        { checkOut: { gte: new Date(from) } },
        { checkOut: null },
      ];
      where.status = { in: ["reserved", "checked_in"] };
    }

    const stays = await prisma.boardingStay.findMany({
      where,
      include: {
        room: true,
        yard: { select: { id: true, name: true } },
        pet: {
          select: {
            id: true, name: true, species: true, breed: true, foodNotes: true, foodBrand: true, foodGramsPerDay: true, foodFrequency: true, medicalNotes: true,
            health: { select: { allergies: true, medicalConditions: true, activityLimitations: true } },
            behavior: { select: { dogAggression: true, humanAggression: true, biteHistory: true, biteDetails: true, separationAnxiety: true, leashReactivity: true, resourceGuarding: true } },
            medications: { select: { medName: true, dosage: true, frequency: true, times: true } },
            serviceDogProfile: { select: { id: true } },
          },
        },
        customer: { select: { id: true, name: true, phone: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { checkIn: "desc" },
      take: 200,
    });

    return NextResponse.json(stays);
  } catch (error) {
    console.error("Error fetching boarding stays:", error);
    return NextResponse.json(
      { error: "Failed to fetch boarding stays" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:boarding:write", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות" }, { status: 429 });
    }

    const body = await request.json();
    const { checkIn, checkOut, petId, customerId, roomId, yardId, status, notes, assignedToUserId } = body;

    if (!checkIn || !petId) {
      return NextResponse.json(
        { error: "Missing required fields: checkIn, petId" },
        { status: 400 }
      );
    }

    // Service dogs have no customer — accept null/empty customerId
    const resolvedCustomerId = customerId || null;

    // Sequential room availability check + create (no interactive $transaction — Supabase PgBouncer incompatible)
    if (roomId) {
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (room) {
        const activeCount = await prisma.boardingStay.count({
          where: {
            roomId,
            status: { in: ["reserved", "checked_in"] },
            checkIn: { lt: checkOut ? new Date(checkOut) : new Date("2099-12-31") },
            OR: [
              { checkOut: { gt: new Date(checkIn) } },
              { checkOut: null },
            ],
          },
        });
        if (activeCount >= room.capacity) {
          return NextResponse.json({ error: "החדר מלא בתאריכים אלו" }, { status: 409 });
        }
      }
    }

    const stay = await prisma.boardingStay.create({
      data: {
        businessId: authResult.businessId,
        checkIn: new Date(checkIn),
        checkOut: checkOut ? new Date(checkOut) : undefined,
        petId,
        customerId: resolvedCustomerId,
        roomId: roomId || null,
        yardId: yardId || null,
        status: status || "reserved",
        notes,
        assignedToUserId: assignedToUserId || null,
      },
      include: {
        room: true,
        yard: { select: { id: true, name: true } },
        pet: {
          select: {
            id: true, name: true, species: true, breed: true, foodNotes: true, foodBrand: true, foodGramsPerDay: true, foodFrequency: true, medicalNotes: true,
            health: { select: { allergies: true, medicalConditions: true, activityLimitations: true } },
            behavior: { select: { dogAggression: true, humanAggression: true, biteHistory: true, biteDetails: true, separationAnxiety: true, leashReactivity: true, resourceGuarding: true } },
            medications: { select: { medName: true, dosage: true, frequency: true, times: true } },
            serviceDogProfile: { select: { id: true } },
          },
        },
        customer: { select: { id: true, name: true, phone: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    logCurrentUserActivity("CREATE_BOARDING_STAY");

    // Send immediate WhatsApp booking confirmation (PRO+ only, fire-and-forget)
    const bizForWa = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { tier: true, featureOverrides: true },
    });
    const waOverrides = (bizForWa?.featureOverrides as Record<string, boolean> | null) ?? null;
    const canSendBoardingWa = hasFeatureWithOverrides(bizForWa?.tier ?? "free", "whatsapp_reminders", waOverrides);
    if (canSendBoardingWa && stay.customer?.phone) {
      const phone = toWhatsAppPhone(stay.customer.phone);
      if (phone) {
        const checkInStr = stay.checkIn.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
        const checkOutStr = stay.checkOut
          ? stay.checkOut.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })
          : "טרם נקבע";
        sendWhatsAppTemplate({
          to: phone,
          templateName: "petra_boarding_confirmation",
          bodyParams: [stay.customer.name, stay.pet.name, checkInStr, checkOutStr],
        }).catch((err) => console.error("Boarding confirmation WA failed:", err));
      }
    }

    // Schedule WhatsApp reminder 24h before checkout (fire-and-forget)
    // Skip for service dogs (no customer to message)
    if (stay.checkOut && stay.customerId) {
      scheduleBoardingCheckoutReminder({
        id: stay.id,
        businessId: authResult.businessId,
        customerId: stay.customerId,
        checkOut: stay.checkOut,
        pet: { name: stay.pet.name },
        customer: { name: stay.customer?.name ?? stay.pet.name },
      }).catch(console.error);
    }

    // Sync to Google Calendar
    await syncBoardingToGcal(stay.id, authResult.businessId).catch((err) =>
      console.error("Failed to sync boarding to GCal:", err)
    );

    return NextResponse.json(stay, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "ROOM_FULL") {
      return NextResponse.json({ error: "החדר תפוס בתאריכים הנבחרים" }, { status: 409 });
    }
    console.error("Error creating boarding stay:", error);
    return NextResponse.json(
      { error: "Failed to create boarding stay" },
      { status: 500 }
    );
  }
}
