import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { logCurrentUserActivity } from "@/lib/activity-log";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { businessId: DEMO_BUSINESS_ID };

    // Optional date range filter for calendar all-day section
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
        pet: true,
        customer: true,
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
    const body = await request.json();
    const { checkIn, checkOut, petId, customerId, roomId, status, notes } =
      body;

    const stay = await prisma.boardingStay.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
        checkIn: new Date(checkIn),
        checkOut: checkOut ? new Date(checkOut) : undefined,
        petId,
        customerId,
        roomId,
        status: status || "reserved",
        notes,
      },
      include: {
        room: true,
        pet: true,
        customer: true,
      },
    });

    logCurrentUserActivity("CREATE_BOARDING_STAY");
    return NextResponse.json(stay, { status: 201 });
  } catch (error) {
    console.error("Error creating boarding stay:", error);
    return NextResponse.json(
      { error: "Failed to create boarding stay" },
      { status: 500 }
    );
  }
}
