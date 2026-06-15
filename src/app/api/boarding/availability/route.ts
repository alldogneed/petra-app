export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { checkRoomAvailability, ServiceError } from "@/services/boarding";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!roomId || !from || !to) {
      return NextResponse.json({ error: "Missing required params: roomId, from, to" }, { status: 400 });
    }

    try {
      const result = await checkRoomAvailability(authResult.businessId, prisma, roomId, from, to);
      return NextResponse.json(result);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") return NextResponse.json({ error: "Room not found" }, { status: 404 });
      throw e;
    }
  } catch (error) {
    console.error("Error checking availability:", error);
    return NextResponse.json({ error: "Failed to check availability" }, { status: 500 });
  }
}
