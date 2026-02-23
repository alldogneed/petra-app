import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      stage,
      notes,
      lostReasonCode,
      lostReasonText,
      lastContactedAt,
      wonAt,
      lostAt,
    } = body;

    const existing = await prisma.lead.findFirst({
      where: { id, businessId: DEMO_BUSINESS_ID },
    });

    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(stage !== undefined && { stage }),
        ...(notes !== undefined && { notes }),
        ...(lostReasonCode !== undefined && { lostReasonCode }),
        ...(lostReasonText !== undefined && { lostReasonText }),
        ...(lastContactedAt !== undefined && {
          lastContactedAt: new Date(lastContactedAt),
        }),
        ...(wonAt !== undefined && { wonAt: wonAt ? new Date(wonAt) : null }),
        ...(lostAt !== undefined && {
          lostAt: lostAt ? new Date(lostAt) : null,
        }),
      },
      include: {
        customer: true,
        callLogs: true,
      },
    });

    return NextResponse.json(lead);
  } catch (error) {
    console.error("Error updating lead:", error);
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const existing = await prisma.lead.findFirst({
      where: { id, businessId: DEMO_BUSINESS_ID },
    });

    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    await prisma.lead.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting lead:", error);
    return NextResponse.json(
      { error: "Failed to delete lead" },
      { status: 500 }
    );
  }
}
