export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { LOST_REASON_CODES } from "@/lib/constants";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;
    const body = await request.json();
    const { reasonCode, reasonText } = body;

    if (!reasonCode) {
      return NextResponse.json(
        { error: "reasonCode is required" },
        { status: 400 }
      );
    }

    const validCodes: string[] = LOST_REASON_CODES.map((r) => r.id);
    if (!validCodes.includes(reasonCode)) {
      return NextResponse.json(
        { error: "Invalid reasonCode" },
        { status: 400 }
      );
    }

    const existing = await prisma.lead.findFirst({
      where: { id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Find the lost stage for this business — auto-create if missing (e.g. older businesses)
    let lostStage = await prisma.leadStage.findFirst({
      where: { businessId: authResult.businessId, isLost: true },
    });
    if (!lostStage) {
      const maxOrder = await prisma.leadStage.aggregate({
        where: { businessId: authResult.businessId },
        _max: { sortOrder: true },
      });
      lostStage = await prisma.leadStage.create({
        data: {
          businessId: authResult.businessId,
          name: "אבד",
          color: "#EF4444",
          sortOrder: (maxOrder._max.sortOrder ?? 5) + 1,
          isLost: true,
          isWon: false,
        },
      });
    }

    if (existing.stage === lostStage.id) {
      return NextResponse.json(
        { error: "Lead is already closed-lost" },
        { status: 400 }
      );
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        stage: lostStage.id,
        lostAt: new Date(),
        lostReasonCode: reasonCode,
        lostReasonText: reasonText || null,
      },
      include: { customer: true, callLogs: true },
    });

    const { session } = authResult;
    logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.CLOSE_LEAD_LOST);

    return NextResponse.json(lead);
  } catch (error) {
    console.error("Error closing lead as lost:", error);
    return NextResponse.json(
      { error: "Failed to close lead as lost" },
      { status: 500 }
    );
  }
}
