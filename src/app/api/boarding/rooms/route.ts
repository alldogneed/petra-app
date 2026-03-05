export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const rooms = await prisma.room.findMany({
      where: { businessId: authResult.businessId },
      include: {
        _count: {
          select: {
            boardingStays: {
              where: { status: { in: ["reserved", "checked_in"] } },
            },
          },
        },
        boardingStays: {
          where: { status: { in: ["reserved", "checked_in"] } },
          include: {
            pet: { select: { id: true, name: true, breed: true, species: true } },
            customer: { select: { id: true, name: true } },
          },
          orderBy: { checkIn: "asc" },
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
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:boarding-rooms:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();
    const { name, capacity, type, pricePerNight } = body;

    const room = await prisma.room.create({
      data: {
        businessId: authResult.businessId,
        name,
        capacity: capacity || 1,
        type: type || "standard",
        pricePerNight: pricePerNight != null ? Number(pricePerNight) : null,
      },
      include: {
        _count: {
          select: {
            boardingStays: {
              where: { status: { in: ["reserved", "checked_in"] } },
            },
          },
        },
        boardingStays: {
          where: { status: { in: ["reserved", "checked_in"] } },
          include: {
            pet: { select: { id: true, name: true, breed: true, species: true } },
            customer: { select: { id: true, name: true } },
          },
          orderBy: { checkIn: "asc" },
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
