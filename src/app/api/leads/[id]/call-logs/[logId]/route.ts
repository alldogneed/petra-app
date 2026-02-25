import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; logId: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id, logId } = params;
    const body = await request.json();
    const { summary, treatment } = body;

    // Verify lead belongs to business
    const lead = await prisma.lead.findFirst({
      where: { id, businessId: DEMO_BUSINESS_ID },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Verify log belongs to lead
    const existing = await prisma.callLog.findFirst({
      where: { id: logId, leadId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Call log not found" },
        { status: 404 }
      );
    }

    const callLog = await prisma.callLog.update({
      where: { id: logId },
      data: {
        ...(summary !== undefined && { summary }),
        ...(treatment !== undefined && { treatment }),
      },
    });

    return NextResponse.json(callLog);
  } catch (error) {
    console.error("Error updating call log:", error);
    return NextResponse.json(
      { error: "Failed to update call log" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; logId: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id, logId } = params;

    // Verify lead belongs to business
    const lead = await prisma.lead.findFirst({
      where: { id, businessId: DEMO_BUSINESS_ID },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Verify log belongs to lead
    const existing = await prisma.callLog.findFirst({
      where: { id: logId, leadId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Call log not found" },
        { status: 404 }
      );
    }

    await prisma.callLog.delete({ where: { id: logId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting call log:", error);
    return NextResponse.json(
      { error: "Failed to delete call log" },
      { status: 500 }
    );
  }
}
