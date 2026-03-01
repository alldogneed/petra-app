export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const relatedEntityType = searchParams.get("relatedEntityType");
    const relatedEntityId = searchParams.get("relatedEntityId");

    const where: any = {
      businessId: authResult.businessId,
    };

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    if (relatedEntityType) {
      where.relatedEntityType = relatedEntityType;
    }

    if (relatedEntityId) {
      where.relatedEntityId = relatedEntityId;
    }

    if (from || to) {
      const dateFilter: any = {};
      const atFilter: any = {};
      if (from) {
        dateFilter.gte = new Date(from + "T00:00:00");
        atFilter.gte = new Date(from + "T00:00:00");
      }
      if (to) {
        dateFilter.lte = new Date(to + "T23:59:59");
        atFilter.lte = new Date(to + "T23:59:59");
      }
      where.OR = [
        { dueDate: dateFilter },
        { dueAt: atFilter },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
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
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "Missing required field: title" },
        { status: 400 }
      );
    }

    const validCategories = ["BOARDING", "TRAINING", "LEADS", "GENERAL", "HEALTH", "MEDICATION", "FEEDING"];
    if (category && !validCategories.includes(category)) {
      return NextResponse.json(
        { error: "Invalid category value" },
        { status: 400 }
      );
    }

    const validPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: "Invalid priority value" },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        businessId: authResult.businessId,
        title,
        description,
        category: category || "GENERAL",
        priority: priority || "MEDIUM",
        status: status || "OPEN",
        dueAt: dueAt ? new Date(dueAt) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        relatedEntityType: relatedEntityType || undefined,
        relatedEntityId: relatedEntityId || undefined,
      },
    });

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
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
