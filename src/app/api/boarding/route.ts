export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { scheduleBoardingCheckoutReminder } from "@/lib/reminder-service";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { businessId: DEMO_BUSINESS_ID };

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
        pet: {
          select: {
            id: true, name: true, species: true, breed: true, foodNotes: true, medicalNotes: true,
            health: { select: { allergies: true, medicalConditions: true, activityLimitations: true } },
            behavior: { select: { dogAggression: true, humanAggression: true, biteHistory: true, biteDetails: true, separationAnxiety: true, leashReactivity: true, resourceGuarding: true } },
            medications: { select: { medName: true, dosage: true, frequency: true, times: true } },
          },
        },
        customer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { checkIn: "desc" },
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
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { checkIn, checkOut, petId, customerId, roomId, status, notes } = body;

    if (!checkIn || !petId || !customerId) {
      return NextResponse.json(
        { error: "Missing required fields: checkIn, petId, customerId" },
        { status: 400 }
      );
    }

    // Check room availability if roomId provided
    if (roomId) {
      const conflicting = await prisma.boardingStay.findFirst({
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

      if (conflicting) {
        // Check capacity
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
            return NextResponse.json(
              { error: "החדר תפוס בתאריכים הנבחרים" },
              { status: 409 }
            );
          }
        }
      }
    }

    const stay = await prisma.boardingStay.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
        checkIn: new Date(checkIn),
        checkOut: checkOut ? new Date(checkOut) : undefined,
        petId,
        customerId,
        roomId: roomId || null,
        status: status || "reserved",
        notes,
      },
      include: {
        room: true,
        pet: {
          select: {
            id: true, name: true, species: true, breed: true, foodNotes: true, medicalNotes: true,
            health: { select: { allergies: true, medicalConditions: true, activityLimitations: true } },
            behavior: { select: { dogAggression: true, humanAggression: true, biteHistory: true, biteDetails: true, separationAnxiety: true, leashReactivity: true, resourceGuarding: true } },
            medications: { select: { medName: true, dosage: true, frequency: true, times: true } },
          },
        },
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    logCurrentUserActivity("CREATE_BOARDING_STAY");

    // Schedule WhatsApp reminder 24h before checkout (fire-and-forget)
    if (stay.checkOut) {
      scheduleBoardingCheckoutReminder({
        id: stay.id,
        businessId: DEMO_BUSINESS_ID,
        customerId: stay.customerId,
        checkOut: stay.checkOut,
        pet: { name: stay.pet.name },
        customer: { name: stay.customer.name },
      }).catch(console.error);
    }

    return NextResponse.json(stay, { status: 201 });
  } catch (error) {
    console.error("Error creating boarding stay:", error);
    return NextResponse.json(
      { error: "Failed to create boarding stay" },
      { status: 500 }
    );
  }
}
