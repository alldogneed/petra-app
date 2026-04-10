export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// POST /api/training-programs/[id]/homework – add a homework item
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { title, description, dueDate } = body;

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

    const item = await prisma.trainingHomework.create({
      data: {
        trainingProgramId: params.id,
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/training-programs/[id]/homework error:", error);
    return NextResponse.json({ error: "Failed to create homework" }, { status: 500 });
  }
}

// PATCH /api/training-programs/[id]/homework – toggle isCompleted (pass homeworkId in body)
export async function PATCH(
  req: NextRequest,
  { params: _params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { homeworkId, isCompleted, customerNotes } = body;

    if (!homeworkId) {
      return NextResponse.json({ error: "homeworkId is required" }, { status: 400 });
    }

    // Verify homework belongs to this business
    const existing = await prisma.trainingHomework.findFirst({
      where: { id: homeworkId, program: { businessId: authResult.businessId } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Homework not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (isCompleted !== undefined) {
      data.isCompleted = isCompleted;
      data.completedAt = isCompleted ? new Date() : null;
    }
    if (customerNotes !== undefined) data.customerNotes = customerNotes;

    const item = await prisma.trainingHomework.update({
      where: { id: homeworkId, trainingProgramId: existing.trainingProgramId },
      data,
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("PATCH /api/training-programs/[id]/homework error:", error);
    return NextResponse.json({ error: "Failed to update homework" }, { status: 500 });
  }
}

// DELETE /api/training-programs/[id]/homework – delete (pass homeworkId in query)
export async function DELETE(
  req: NextRequest,
  { params: _params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(req.url);
    const homeworkId = searchParams.get("homeworkId");
    if (!homeworkId) {
      return NextResponse.json({ error: "homeworkId is required" }, { status: 400 });
    }

    // Verify homework belongs to this business
    const existing = await prisma.trainingHomework.findFirst({
      where: { id: homeworkId, program: { businessId: authResult.businessId } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Homework not found" }, { status: 404 });
    }

    await prisma.trainingHomework.delete({ where: { id: homeworkId, trainingProgramId: existing.trainingProgramId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/training-programs/[id]/homework error:", error);
    return NextResponse.json({ error: "Failed to delete homework" }, { status: 500 });
  }
}
