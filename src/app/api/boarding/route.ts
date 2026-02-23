import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function GET() {
  try {
    const stays = await prisma.boardingStay.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
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
        status: status || "RESERVED",
        notes,
      },
      include: {
        room: true,
        pet: true,
        customer: true,
      },
    });

    return NextResponse.json(stay, { status: 201 });
  } catch (error) {
    console.error("Error creating boarding stay:", error);
    return NextResponse.json(
      { error: "Failed to create boarding stay" },
      { status: 500 }
    );
  }
}
