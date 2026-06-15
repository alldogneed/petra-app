export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { createProgramGoal, updateProgramGoal, deleteProgramGoal, ServiceError } from "@/services/training";

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

    let goal;
    try {
      goal = await createProgramGoal(authResult.businessId, prisma, params.id, {
        title,
        description: description || null,
        targetDate: targetDate ? new Date(targetDate) : null,
      });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error("POST /api/training-programs/[id]/goals error:", error);
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params: _params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(req.url);
    const goalId = searchParams.get("goalId");
    if (!goalId) return NextResponse.json({ error: "goalId is required" }, { status: 400 });

    try {
      await deleteProgramGoal(authResult.businessId, prisma, goalId);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/training-programs/[id]/goals error:", error);
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { goalId, title, description, status, progressPercent, targetDate } = body;

    if (!goalId) {
      return NextResponse.json({ error: "goalId is required" }, { status: 400 });
    }

    let goal;
    try {
      goal = await updateProgramGoal(authResult.businessId, prisma, goalId, {
        title,
        description,
        status,
        progressPercent: progressPercent !== undefined ? parseInt(progressPercent) : undefined,
        targetDate: targetDate !== undefined ? (targetDate ? new Date(targetDate) : null) : undefined,
      });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(goal);
  } catch (error) {
    console.error("PATCH /api/training-programs/[id]/goals error:", error);
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
  }
}
