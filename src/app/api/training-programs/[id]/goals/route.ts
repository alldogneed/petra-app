export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// POST /api/training-programs/[id]/goals – add a training goal
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { title, description, targetDate } = body;

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    // Verify program belongs to this business
    const program = await prisma.trainingProgram.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!program) {
      return NextResponse.json({ error: "Training program not found" }, { status: 404 });
    }

    // Get current max sortOrder
    const existing = await prisma.trainingGoal.findMany({
      where: { trainingProgramId: params.id },
      select: { sortOrder: true },
      orderBy: { sortOrder: "desc" },
      take: 1,
    });
    const nextOrder = existing.length > 0 ? existing[0].sortOrder + 1 : 0;

    const goal = await prisma.trainingGoal.create({
      data: {
        trainingProgramId: params.id,
        title,
        description: description || null,
        targetDate: targetDate ? new Date(targetDate) : null,
        sortOrder: nextOrder,
      },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error("POST /api/training-programs/[id]/goals error:", error);
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
  }
}

// DELETE /api/training-programs/[id]/goals?goalId=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(req.url);
    const goalId = searchParams.get("goalId");
    if (!goalId) return NextResponse.json({ error: "goalId is required" }, { status: 400 });

    // Verify ownership via program
    const goal = await prisma.trainingGoal.findFirst({
      where: { id: goalId, program: { businessId: authResult.businessId } },
    });
    if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

    await prisma.trainingGoal.delete({ where: { id: goalId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/training-programs/[id]/goals error:", error);
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 });
  }
}

// PATCH /api/training-programs/[id]/goals – update a goal (pass goalId in body)
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { goalId, title, description, status, progressPercent, targetDate } = body;

    if (!goalId) {
      return NextResponse.json({ error: "goalId is required" }, { status: 400 });
    }

    // Verify goal belongs to this business
    const existing = await prisma.trainingGoal.findFirst({
      where: { id: goalId, program: { businessId: authResult.businessId } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    const data: any = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (status !== undefined) data.status = status;
    if (progressPercent !== undefined) data.progressPercent = parseInt(progressPercent);
    if (targetDate !== undefined) data.targetDate = targetDate ? new Date(targetDate) : null;

    const goal = await prisma.trainingGoal.update({
      where: { id: goalId },
      data,
    });

    return NextResponse.json(goal);
  } catch (error) {
    console.error("PATCH /api/training-programs/[id]/goals error:", error);
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
  }
}
