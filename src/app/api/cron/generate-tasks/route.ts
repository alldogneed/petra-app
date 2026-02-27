export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildRruleDates } from "@/lib/rrule-utils";

/**
 * GET /api/cron/generate-tasks
 * Generates tasks for all active recurrence rules for the next 7 days.
 * Called daily via Vercel Cron (see vercel.json).
 * Requires x-cron-secret header or ?secret= query param.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !secret || secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Fetch all active rules across all businesses
    const rules = await prisma.taskRecurrenceRule.findMany({
      where: { isActive: true },
      include: { template: true },
    });

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const rule of rules) {
      const dates = buildRruleDates(rule.rrule, rule.startAt, now, windowEnd, rule.endAt);

      for (const date of dates) {
        const dueDate = new Date(date);
        dueDate.setHours(0, 0, 0, 0);

        // Skip if task already exists for this rule+date
        const existing = await prisma.task.findFirst({
          where: {
            recurrenceRuleId: rule.id,
            dueDate: {
              gte: dueDate,
              lt: new Date(dueDate.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        });

        if (existing) {
          totalSkipped++;
          continue;
        }

        await prisma.task.create({
          data: {
            businessId: rule.businessId,
            title: rule.template.defaultTitleTemplate,
            description: rule.template.defaultDescriptionTemplate || null,
            category: rule.template.defaultCategory,
            priority: rule.template.defaultPriority,
            status: "OPEN",
            dueDate,
            recurrenceRuleId: rule.id,
            ...(rule.relatedEntityType && { relatedEntityType: rule.relatedEntityType }),
            ...(rule.relatedEntityId && { relatedEntityId: rule.relatedEntityId }),
          },
        });
        totalCreated++;
      }

      // Update lastGeneratedAt
      await prisma.taskRecurrenceRule.update({
        where: { id: rule.id },
        data: { lastGeneratedAt: now },
      });
    }

    return NextResponse.json({
      ok: true,
      rules: rules.length,
      created: totalCreated,
      skipped: totalSkipped,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("CRON generate-tasks error:", error);
    return NextResponse.json({ error: "Failed to generate tasks" }, { status: 500 });
  }
}
