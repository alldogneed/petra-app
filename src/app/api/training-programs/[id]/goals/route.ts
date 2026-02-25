import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

// POST /api/training-programs/[id]/goals – add a training goal
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { title, description, targetDate } = body;

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
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

// PATCH /api/training-programs/[id]/goals – update a goal (pass goalId in body)
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { goalId, title, description, status, progressPercent, targetDate } = body;

    if (!goalId) {
      return NextResponse.json({ error: "goalId is required" }, { status: 400 });
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
