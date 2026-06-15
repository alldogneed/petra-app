export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { getTask, updateTask, deleteTask, ServiceError, type UpdateTaskInput } from "@/services/clients";

const PatchTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.enum(["GENERAL", "BOARDING", "TRAINING", "LEADS", "HEALTH", "MEDICATION", "FEEDING"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELED"]).optional(),
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

    const task = await getTask(authResult.businessId, prisma, params.id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const raw = await request.json();
    const parsed = PatchTaskSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    let task;
    try {
      task = await updateTask(
        authResult.businessId, prisma, params.id,
        parsed.data as UpdateTaskInput,
        authResult.session.user.id
      );
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 400 });
      }
      throw e;
    }

    const { session } = authResult;
    const status = parsed.data.status;
    const action =
      status === "COMPLETED" ? ACTIVITY_ACTIONS.COMPLETE_TASK :
      status === "CANCELED"  ? ACTIVITY_ACTIONS.CANCEL_TASK : undefined;
    if (action) logActivity(session.user.id, session.user.name, action);

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    try {
      await deleteTask(authResult.businessId, prisma, params.id, authResult.session.user.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
