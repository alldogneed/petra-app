export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { listTasks, createTask, ServiceError } from "@/services/clients";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const opts = {
      category: searchParams.get("category") || undefined,
      status: searchParams.get("status") || undefined,
      excludeCompleted: searchParams.get("excludeCompleted") === "true",
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      relatedEntityType: searchParams.get("relatedEntityType") || undefined,
      relatedEntityId: searchParams.get("relatedEntityId") || undefined,
    };

    let tasks;
    try {
      tasks = await listTasks(authResult.businessId, prisma, opts);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "VALIDATION") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:tasks:write", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות" }, { status: 429 });
    }

    const body = await request.json();

    let task;
    try {
      task = await createTask(authResult.businessId, prisma, body);
    } catch (e) {
      if (e instanceof ServiceError) {
        const status = e.code === "VALIDATION" ? (
          (e.details as { code?: string } | null)?.code === "LIMIT_REACHED" ? 403 : 400
        ) : 400;
        return NextResponse.json({ error: e.message }, { status });
      }
      throw e;
    }

    logCurrentUserActivity("CREATE_TASK");

    await prisma.taskAuditLog.create({
      data: {
        taskId: task.id,
        action: "CREATED",
        userId: authResult.session.user.id,
        payload: JSON.stringify({ title: task.title, priority: task.priority, category: task.category }),
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    console.error("Error creating task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
