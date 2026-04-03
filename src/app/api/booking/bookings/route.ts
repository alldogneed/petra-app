export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const VALID_BOOKING_STATUSES = ["pending", "confirmed", "declined", "cancelled"];

    const where: any = { businessId: authResult.businessId };
    if (status) {
      if (!VALID_BOOKING_STATUSES.includes(status)) {
        return NextResponse.json({ error: "סטטוס לא חוקי" }, { status: 400 });
      }
      where.status = status;
    }
    if (from || to) {
      where.startAt = {};
      if (from) where.startAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1);
        where.startAt.lte = toDate;
      }
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        service: true,
        priceListItem: true,
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
