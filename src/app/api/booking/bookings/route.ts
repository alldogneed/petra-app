import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: any = { businessId: DEMO_BUSINESS_ID };
    if (status) where.status = status;

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        service: true,
        customer: true,
        dogs: {
          include: { pet: true },
        },
      },
      orderBy: { startAt: "desc" },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("GET bookings error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת הזמנות" }, { status: 500 });
  }
}
