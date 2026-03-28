export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const yards = await prisma.yard.findMany({
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

    return NextResponse.json(yards);
  } catch (error) {
    console.error("Error fetching boarding yards:", error);
    return NextResponse.json(
      { error: "Failed to fetch boarding yards" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:boarding-yards:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();
    const { name, capacity, type, pricePerSession } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "שם החצר הוא שדה חובה" }, { status: 400 });
    }

    const parsedPrice = pricePerSession != null ? Number(pricePerSession) : null;
    if (parsedPrice !== null && (isNaN(parsedPrice) || parsedPrice < 0)) {
      return NextResponse.json({ error: "מחיר לשהייה לא תקין" }, { status: 400 });
    }

    const yard = await prisma.yard.create({
      data: {
        businessId: authResult.businessId,
        name: name.trim(),
        capacity: capacity || 1,
        type: type || "standard",
        pricePerSession: parsedPrice,
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

    return NextResponse.json(yard, { status: 201 });
  } catch (error) {
    console.error("Error creating boarding yard:", error);
    return NextResponse.json(
      { error: "Failed to create boarding yard" },
      { status: 500 }
    );
  }
}
