import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
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
