export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

/** GET /api/billing/events — returns subscription events for the caller's business */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const events = await prisma.subscriptionEvent.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        eventType: true,
        tier: true,
        cardcomDealId: true,
        amount: true,
        createdAt: true,
      },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("GET /api/billing/events error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת עסקאות" }, { status: 500 });
  }
}
