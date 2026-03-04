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

    const { id } = params;
    const body = await request.json();
    const { name, color } = body;

    const existing = await prisma.leadStage.findFirst({
      where: { id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Stage not found" },
        { status: 404 }
      );
    }

    const stage = await prisma.leadStage.update({
      where: { id, businessId: authResult.businessId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(color !== undefined && { color }),
      },
    });

    return NextResponse.json(stage);
  } catch (error) {
    console.error("Error updating lead stage:", error);
    return NextResponse.json(
      { error: "Failed to update lead stage" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;

    const existing = await prisma.leadStage.findFirst({
      where: { id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Stage not found" },
        { status: 404 }
      );
    }

    if (existing.isWon || existing.isLost) {
      return NextResponse.json(
        { error: "Cannot delete Won or Lost stages" },
        { status: 403 }
      );
    }

    // Check if any leads are in this stage
    const leadCount = await prisma.lead.count({
      where: { businessId: authResult.businessId, stage: id },
    });

    if (leadCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete stage with active leads", leadCount },
        { status: 409 }
      );
    }

    await prisma.leadStage.delete({ where: { id, businessId: authResult.businessId } });

    // Re-index sortOrder to close gaps
    const remaining = await prisma.leadStage.findMany({
      where: { businessId: authResult.businessId },
      orderBy: { sortOrder: "asc" },
    });

    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].sortOrder !== i) {
        await prisma.leadStage.update({
          where: { id: remaining[i].id },
          data: { sortOrder: i },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting lead stage:", error);
    return NextResponse.json(
      { error: "Failed to delete lead stage" },
      { status: 500 }
    );
  }
}
