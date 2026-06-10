export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildRruleDates } from "@/lib/rrule-utils";
import { verifyCronAuth } from "@/lib/cron-auth";

/**
 * GET /api/cron/generate-tasks
 * Generates tasks for all active recurrence rules for the next 7 days.
 * Called daily via Vercel Cron (see vercel.json).
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
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

    // ── Training follow-up tasks ──────────────────────────────────────────────
    // (a) Active non-service-dog programs with no completed session in 14+ days.
    // (b) Upcoming group/workshop sessions in the next 2 days (prep reminder).
    const DAY_MS = 24 * 60 * 60 * 1000;
    const ago14Days = new Date(now.getTime() - 14 * DAY_MS);
    let trainingCreated = 0;

    const activePrograms = await prisma.trainingProgram.findMany({
      where: { trainingType: { not: "SERVICE_DOG" }, status: "ACTIVE" },
      include: {
        dog: { select: { name: true } },
        customer: { select: { name: true } },
        sessions: { where: { status: "COMPLETED" }, orderBy: { sessionDate: "desc" }, take: 1 },
      },
    });

    for (const prog of activePrograms) {
      const last = prog.sessions[0];
      if (last && new Date(last.sessionDate) >= ago14Days) continue; // recent enough

      const taskEntityId = `training-gap-${prog.id}`;
      const existingTask = await prisma.task.findFirst({
        where: { businessId: prog.businessId, relatedEntityType: "TRAINING_PROGRAM", relatedEntityId: taskEntityId, status: "OPEN" },
      });
      if (existingTask) { totalSkipped++; continue; }

      const dogName = prog.dog?.name ?? prog.name;
      const daysSince = last
        ? Math.floor((now.getTime() - new Date(last.sessionDate).getTime()) / DAY_MS)
        : null;
      const description = daysSince !== null
        ? `תוכנית האילוף של ${dogName}${prog.customer ? ` (${prog.customer.name})` : ""} פעילה אך לא התקיים מפגש ב-${daysSince} ימים. כדאי לקבוע מפגש המשך.`
        : `תוכנית האילוף של ${dogName}${prog.customer ? ` (${prog.customer.name})` : ""} פעילה אך טרם התקיים מפגש. כדאי לקבוע מפגש ראשון.`;

      await prisma.task.create({
        data: {
          businessId: prog.businessId,
          title: `מעקב אילוף — ${dogName}`,
          description,
          category: "TRAINING",
          priority: daysSince !== null && daysSince > 21 ? "HIGH" : "MEDIUM",
          status: "OPEN",
          relatedEntityType: "TRAINING_PROGRAM",
          relatedEntityId: taskEntityId,
        },
      });
      trainingCreated++;
    }

    const soon = new Date(now.getTime() + 2 * DAY_MS);
    const upcomingGroupSessions = await prisma.trainingGroupSession.findMany({
      where: { status: "SCHEDULED", sessionDatetime: { gte: now, lte: soon } },
      include: { trainingGroup: { select: { businessId: true, name: true } } },
    });

    for (const session of upcomingGroupSessions) {
      const taskEntityId = `group-session-${session.id}`;
      const businessId = session.trainingGroup.businessId;
      const existingTask = await prisma.task.findFirst({
        where: { businessId, relatedEntityType: "TRAINING_GROUP", relatedEntityId: taskEntityId, status: "OPEN" },
      });
      if (existingTask) { totalSkipped++; continue; }

      await prisma.task.create({
        data: {
          businessId,
          title: `הכנה למפגש קבוצתי — ${session.trainingGroup.name}`,
          description: `מפגש קבוצתי "${session.trainingGroup.name}" מתקיים בקרוב. ודא ציוד, מיקום ורשימת משתתפים.`,
          category: "TRAINING",
          priority: "MEDIUM",
          status: "OPEN",
          dueDate: session.sessionDatetime,
          relatedEntityType: "TRAINING_GROUP",
          relatedEntityId: taskEntityId,
        },
      });
      trainingCreated++;
    }

    totalCreated += trainingCreated;

    return NextResponse.json({
      ok: true,
      rules: rules.length,
      created: totalCreated,
      trainingCreated,
      skipped: totalSkipped,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("CRON generate-tasks error:", error);
    return NextResponse.json({ error: "Failed to generate tasks" }, { status: 500 });
  }
}
