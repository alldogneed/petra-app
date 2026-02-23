import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
      include: {
        _count: {
          select: { boardingStays: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(rooms);
  } catch (error) {
    console.error("Error fetching boarding rooms:", error);
    return NextResponse.json(
      { error: "Failed to fetch boarding rooms" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, capacity, type } = body;

    const room = await prisma.room.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
        name,
        capacity: capacity || 1,
        type: type || "STANDARD",
      },
      include: {
        _count: {
          select: { boardingStays: true },
        },
      },
    });

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error("Error creating boarding room:", error);
    return NextResponse.json(
      { error: "Failed to create boarding room" },
      { status: 500 }
    );
  }
}
