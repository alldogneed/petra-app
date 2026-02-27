export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;

    const task = await prisma.task.findFirst({
      where: { id, businessId: DEMO_BUSINESS_ID },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;
    const body = await request.json();

    const existing = await prisma.task.findFirst({
      where: { id, businessId: DEMO_BUSINESS_ID },
    });

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const {
      title,
      description,
      category,
      priority,
      status,
      dueAt,
      dueDate,
      relatedEntityType,
      relatedEntityId,
      reminderEnabled,
    } = body;

    // If status is changing to COMPLETED, set completedAt automatically
    const isCompleting =
      status === "COMPLETED" && existing.status !== "COMPLETED";
    const isReopening =
      status !== undefined &&
      status !== "COMPLETED" &&
      existing.status === "COMPLETED";

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(priority !== undefined && { priority }),
        ...(status !== undefined && { status }),
        ...(dueAt !== undefined && { dueAt: dueAt ? new Date(dueAt) : null }),
        ...(dueDate !== undefined && {
          dueDate: dueDate ? new Date(dueDate) : null,
        }),
        ...(relatedEntityType !== undefined && { relatedEntityType }),
        ...(relatedEntityId !== undefined && { relatedEntityId }),
        ...(reminderEnabled !== undefined && { reminderEnabled }),
        ...(isCompleting && { completedAt: new Date() }),
        ...(isReopening && { completedAt: null }),
      },
    });

    const { session } = authResult;
    const action =
      status === "COMPLETED" ? ACTIVITY_ACTIONS.COMPLETE_TASK :
      status === "CANCELED" ? ACTIVITY_ACTIONS.CANCEL_TASK :
      undefined;
    if (action) logActivity(session.user.id, session.user.name, action);

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;

    const existing = await prisma.task.findFirst({
      where: { id, businessId: DEMO_BUSINESS_ID },
    });

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await prisma.task.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
