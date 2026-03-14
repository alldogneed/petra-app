export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { notificationStatus } = body;

    if (!notificationStatus || !["SENT", "WAIVED"].includes(notificationStatus)) {
      return NextResponse.json({ error: "סטטוס לא חוקי" }, { status: 400 });
    }

    const event = await prisma.serviceDogComplianceEvent.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });

    if (!event) {
      return NextResponse.json({ error: "אירוע משמעת לא נמצא" }, { status: 404 });
    }

    const updated = await prisma.serviceDogComplianceEvent.update({
      where: { id: params.id, businessId: authResult.businessId },
      data: {
        notificationStatus,
        ...(notificationStatus === "SENT" && { notificationSentAt: new Date() }),
      },
    });

    // Check if there are remaining pending events for this dog
    const remainingPending = await prisma.serviceDogComplianceEvent.count({
      where: {
        serviceDogId: event.serviceDogId,
        businessId: authResult.businessId,
        notificationStatus: "PENDING",
        id: { not: params.id },
      },
    });

    if (remainingPending === 0) {
      await prisma.serviceDogProfile.update({
        where: { id: event.serviceDogId, businessId: authResult.businessId },
        data: { isGovReportPending: false, govReportDue: null },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/service-compliance/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון אירוע משמעת" }, { status: 500 });
  }
}
