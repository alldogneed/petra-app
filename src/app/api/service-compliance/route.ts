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

    const where: Record<string, unknown> = { businessId: DEMO_BUSINESS_ID };

    if (status === "OVERDUE") {
      where.notificationStatus = "PENDING";
      where.notificationDue = { lt: new Date() };
    } else if (status === "PENDING") {
      where.notificationStatus = "PENDING";
      where.notificationDue = { gte: new Date() };
    } else if (status) {
      where.notificationStatus = status;
    }

    const events = await prisma.serviceDogComplianceEvent.findMany({
      where,
      include: {
        serviceDog: { include: { pet: true } },
        placement: { include: { recipient: true } },
      },
      orderBy: { notificationDue: "asc" },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("GET /api/service-compliance error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת אירועי ציות" }, { status: 500 });
  }
}
