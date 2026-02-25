import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

/**
 * GET /api/boarding/availability?roomId=xxx&from=2026-02-20&to=2026-02-25
 * Checks if a room is available for the given date range.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!roomId || !from || !to) {
      return NextResponse.json(
        { error: "Missing required params: roomId, from, to" },
        { status: 400 }
      );
    }

    const room = await prisma.room.findFirst({
      where: { id: roomId, businessId: DEMO_BUSINESS_ID },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Find overlapping active stays
    const conflicts = await prisma.boardingStay.findMany({
      where: {
        roomId,
        status: { in: ["reserved", "checked_in"] },
        checkIn: { lt: new Date(to + "T23:59:59") },
        OR: [
          { checkOut: { gt: new Date(from) } },
          { checkOut: null },
        ],
      },
      include: {
        pet: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
    });

    const available = conflicts.length < room.capacity;

    return NextResponse.json({
      available,
      capacity: room.capacity,
      occupiedSlots: conflicts.length,
      conflicts,
    });
  } catch (error) {
    console.error("Error checking availability:", error);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}
