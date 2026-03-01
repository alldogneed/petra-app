export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { stageIds } = body;

    if (!Array.isArray(stageIds) || stageIds.length === 0) {
      return NextResponse.json(
        { error: "stageIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Verify all stage IDs belong to this business
    const dbStages = await prisma.leadStage.findMany({
      where: { businessId: authResult.businessId },
    });
    const dbIds = new Set(dbStages.map((s) => s.id));

    for (const id of stageIds) {
      if (!dbIds.has(id)) {
        return NextResponse.json(
          { error: `Stage ${id} not found` },
          { status: 400 }
        );
      }
    }

    // Update sortOrder in a transaction
    await prisma.$transaction(
      stageIds.map((id: string, index: number) =>
        prisma.leadStage.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    const updated = await prisma.leadStage.findMany({
      where: { businessId: authResult.businessId },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error reordering lead stages:", error);
    return NextResponse.json(
      { error: "Failed to reorder stages" },
      { status: 500 }
    );
  }
}
