import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const relatedEntityType = searchParams.get("relatedEntityType");
    const relatedEntityId = searchParams.get("relatedEntityId");

    const where: any = {
      businessId: DEMO_BUSINESS_ID,
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
      where.dueDate = {};
      if (from) {
        where.dueDate.gte = new Date(from);
      }
      if (to) {
        where.dueDate.lte = new Date(to);
      }
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

    const task = await prisma.task.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
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

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
