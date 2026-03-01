export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";

const PatchTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.enum(["GENERAL", "BOARDING", "TRAINING", "LEADS", "HEALTH", "MEDICATION", "FEEDING"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["OPEN", "COMPLETED", "CANCELED"]).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  relatedEntityType: z.string().max(50).nullable().optional(),
  relatedEntityId: z.string().max(100).nullable().optional(),
  reminderEnabled: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;

    const task = await prisma.task.findFirst({
      where: { id, businessId: authResult.businessId },
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
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;
    const raw = await request.json();
    const parsed = PatchTaskSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    const existing = await prisma.task.findFirst({
      where: { id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const { title, description, category, priority, status, dueAt, dueDate, relatedEntityType, relatedEntityId, reminderEnabled } = body;

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

    // Write audit log entry
    const auditAction = isCompleting ? "COMPLETED" : isReopening ? "REOPENED" :
      status === "CANCELED" ? "CANCELED" : "UPDATED";
    await prisma.taskAuditLog.create({
      data: {
        taskId: id,
        action: auditAction,
        userId: session.user.id,
        payload: JSON.stringify({ status, title, priority }),
      },
    });

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
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;

    const existing = await prisma.task.findFirst({
      where: { id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Audit before delete (so taskId still valid)
    await prisma.taskAuditLog.create({
      data: {
        taskId: id,
        action: "DELETED",
        userId: authResult.session.user.id,
        payload: JSON.stringify({ title: existing.title }),
      },
    });

    await prisma.task.delete({ where: { id, businessId: authResult.businessId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
