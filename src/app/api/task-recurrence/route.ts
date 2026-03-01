export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const rules = await prisma.taskRecurrenceRule.findMany({
      where: { businessId: authResult.businessId },
      include: {
        template: {
          select: { id: true, name: true, defaultCategory: true, defaultPriority: true, defaultTitleTemplate: true },
        },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error("GET task-recurrence error:", error);
    return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { templateId, rrule, startAt, endAt, timezone = "Asia/Jerusalem", relatedEntityType, relatedEntityId } = body;

    if (!templateId || !rrule || !startAt) {
      return NextResponse.json(
        { error: "templateId, rrule, and startAt are required" },
        { status: 400 }
      );
    }

    // Verify template belongs to this business
    const template = await prisma.taskTemplate.findFirst({
      where: { id: templateId, businessId: authResult.businessId },
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const rule = await prisma.taskRecurrenceRule.create({
      data: {
        templateId,
        rrule,
        startAt: new Date(startAt),
        endAt: endAt ? new Date(endAt) : null,
        timezone,
        relatedEntityType: relatedEntityType || null,
        relatedEntityId: relatedEntityId || null,
        businessId: authResult.businessId,
      },
      include: {
        template: {
          select: { id: true, name: true, defaultCategory: true, defaultPriority: true, defaultTitleTemplate: true },
        },
        _count: { select: { tasks: true } },
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("POST task-recurrence error:", error);
    return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
  }
}
