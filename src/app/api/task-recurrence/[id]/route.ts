export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { buildRruleDates } from "@/lib/rrule-utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.taskRecurrenceRule.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const rule = await prisma.taskRecurrenceRule.update({
      where: { id: params.id, businessId: authResult.businessId },
      data: {
        ...(body.rrule !== undefined && { rrule: body.rrule }),
        ...(body.startAt !== undefined && { startAt: new Date(body.startAt) }),
        ...(body.endAt !== undefined && { endAt: body.endAt ? new Date(body.endAt) : null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.timezone !== undefined && { timezone: body.timezone }),
      },
      include: {
        template: {
          select: { id: true, name: true, defaultCategory: true, defaultPriority: true, defaultTitleTemplate: true },
        },
        _count: { select: { tasks: true } },
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error("PATCH task-recurrence error:", error);
    return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.taskRecurrenceRule.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.taskRecurrenceRule.delete({ where: { id: params.id, businessId: authResult.businessId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE task-recurrence error:", error);
    return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
  }
}

// POST /api/task-recurrence/[id]?action=generate
// Generates tasks for the next N days based on the recurrence rule
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const rule = await prisma.taskRecurrenceRule.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: {
        template: true,
      },
    });
    if (!rule) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const days = Math.min(body.days ?? 30, 90);

    const now = new Date();
    const windowEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const windowStart = now;

    // Generate occurrence dates
    const dates = buildRruleDates(rule.rrule, rule.startAt, windowStart, windowEnd, rule.endAt);

    if (dates.length === 0) {
      return NextResponse.json({ created: 0, message: "לא נמצאו תאריכים ביחס לחוק" });
    }

    // Create tasks for each date (avoid duplicates by checking dueDate)
    const template = rule.template;
    let created = 0;

    for (const date of dates) {
      const dueDate = new Date(date);
      dueDate.setHours(0, 0, 0, 0);

      // Check if task already exists for this rule+date
      const existing = await prisma.task.findFirst({
        where: {
          recurrenceRuleId: rule.id,
          dueDate: {
            gte: new Date(dueDate.getTime()),
            lt: new Date(dueDate.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      });

      if (existing) continue;

      await prisma.task.create({
        data: {
          businessId: authResult.businessId,
          title: template.defaultTitleTemplate,
          description: template.defaultDescriptionTemplate || null,
          category: template.defaultCategory,
          priority: template.defaultPriority,
          status: "OPEN",
          dueDate,
          recurrenceRuleId: rule.id,
          ...(rule.relatedEntityType && { relatedEntityType: rule.relatedEntityType }),
          ...(rule.relatedEntityId && { relatedEntityId: rule.relatedEntityId }),
        },
      });
      created++;
    }

    // Update lastGeneratedAt
    await prisma.taskRecurrenceRule.update({
      where: { id: rule.id },
      data: { lastGeneratedAt: now },
    });

    return NextResponse.json({ created, total: dates.length });
  } catch (error) {
    console.error("POST task-recurrence/generate error:", error);
    return NextResponse.json({ error: "Failed to generate tasks" }, { status: 500 });
  }
}
