import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { LOST_REASON_CODES } from "@/lib/constants";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
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
      where: { id, businessId: DEMO_BUSINESS_ID },
    });

    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (existing.stage === "lost") {
      return NextResponse.json(
        { error: "Lead is already closed-lost" },
        { status: 400 }
      );
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        stage: "lost",
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
