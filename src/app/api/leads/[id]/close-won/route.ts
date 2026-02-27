import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;

    const existing = await prisma.lead.findFirst({
      where: { id, businessId: DEMO_BUSINESS_ID },
    });

    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (existing.stage === "won") {
      return NextResponse.json(
        { error: "Lead is already closed-won" },
        { status: 400 }
      );
    }

    // If lead already has a customer, just update the stage
    if (existing.customerId) {
      const lead = await prisma.lead.update({
        where: { id },
        data: {
          stage: "won",
          wonAt: new Date(),
        },
        include: { customer: true, callLogs: true },
      });

      return NextResponse.json({
        lead,
        customerId: existing.customerId,
      });
    }

    // Atomic transaction: create customer + update lead + create timeline event
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          name: existing.name,
          phone: existing.phone || "",
          email: existing.email,
          source: existing.source,
          notes: existing.notes,
          businessId: DEMO_BUSINESS_ID,
        },
      });

      const lead = await tx.lead.update({
        where: { id },
        data: {
          stage: "won",
          wonAt: new Date(),
          customerId: customer.id,
        },
        include: { customer: true, callLogs: true },
      });

      await tx.timelineEvent.create({
        data: {
          type: "lead_converted",
          description: "ליד הומר ללקוח",
          customerId: customer.id,
          businessId: DEMO_BUSINESS_ID,
        },
      });

      return { lead, customerId: customer.id };
    });

    const { session } = authResult;
    logActivity(session.user.id, session.user.name, ACTIVITY_ACTIONS.CLOSE_LEAD_WON);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error closing lead as won:", error);
    return NextResponse.json(
      { error: "Failed to close lead" },
      { status: 500 }
    );
  }
}
