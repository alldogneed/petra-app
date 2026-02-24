import { prisma } from "@/lib/prisma";

/**
 * Simple RRULE parser supporting: FREQ=DAILY|WEEKLY|MONTHLY, INTERVAL, BYDAY
 * Returns dates between rangeStart and rangeEnd matching the rule.
 */
function expandRRule(
  rrule: string,
  ruleStart: Date,
  rangeStart: Date,
  rangeEnd: Date,
  ruleEnd: Date | null
): Date[] {
  const parts: Record<string, string> = {};
  rrule.split(";").forEach((p) => {
    const [k, v] = p.split("=");
    parts[k] = v;
  });

  const freq = parts.FREQ || "DAILY";
  const interval = parseInt(parts.INTERVAL || "1", 10);
  const byDay = parts.BYDAY ? parts.BYDAY.split(",") : null;

  const DAY_MAP: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  const effectiveEnd = ruleEnd && ruleEnd < rangeEnd ? ruleEnd : rangeEnd;
  const dates: Date[] = [];
  const cursor = new Date(ruleStart);

  // Advance cursor to rangeStart if needed
  const maxIterations = 1000;
  let iterations = 0;

  while (cursor <= effectiveEnd && iterations < maxIterations) {
    iterations++;

    if (cursor >= rangeStart && cursor <= effectiveEnd) {
      if (byDay) {
        // For WEEKLY with BYDAY, check if cursor's day matches
        const dayName = Object.entries(DAY_MAP).find(([, v]) => v === cursor.getDay())?.[0];
        if (dayName && byDay.includes(dayName)) {
          dates.push(new Date(cursor));
        }
      } else {
        dates.push(new Date(cursor));
      }
    }

    // Advance cursor
    if (freq === "DAILY") {
      cursor.setDate(cursor.getDate() + (byDay ? 1 : interval));
    } else if (freq === "WEEKLY") {
      if (byDay) {
        cursor.setDate(cursor.getDate() + 1);
      } else {
        cursor.setDate(cursor.getDate() + 7 * interval);
      }
    } else if (freq === "MONTHLY") {
      cursor.setMonth(cursor.getMonth() + interval);
    }
  }

  return dates;
}

/**
 * Generate tasks for the next N days from active recurrence rules.
 * Idempotent: checks for existing tasks before creating duplicates.
 */
export async function generateRecurringTasks(daysAhead: number = 14): Promise<number> {
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + daysAhead);

  const rules = await prisma.taskRecurrenceRule.findMany({
    where: {
      isActive: true,
      startAt: { lte: rangeEnd },
      OR: [
        { endAt: null },
        { endAt: { gte: rangeStart } },
      ],
    },
    include: { template: true },
  });

  let created = 0;

  for (const rule of rules) {
    const dates = expandRRule(
      rule.rrule,
      rule.startAt,
      rangeStart,
      rangeEnd,
      rule.endAt
    );

    for (const date of dates) {
      const dateStr = date.toISOString().split("T")[0];

      // Idempotency check: does a task already exist for this rule + date?
      const existing = await prisma.task.findFirst({
        where: {
          recurrenceRuleId: rule.id,
          dueDate: {
            gte: new Date(dateStr + "T00:00:00Z"),
            lte: new Date(dateStr + "T23:59:59Z"),
          },
        },
      });

      if (!existing) {
        const task = await prisma.task.create({
          data: {
            businessId: rule.businessId,
            title: rule.template.defaultTitleTemplate,
            description: rule.template.defaultDescriptionTemplate,
            category: rule.template.defaultCategory,
            priority: rule.template.defaultPriority,
            status: "OPEN",
            dueDate: new Date(dateStr + "T00:00:00Z"),
            relatedEntityType: rule.relatedEntityType || rule.template.relatedEntityType,
            relatedEntityId: rule.relatedEntityId,
            reminderEnabled: rule.template.reminderDefaultEnabled,
            reminderLeadMinutes: rule.template.reminderDefaultLeadMinutes,
            templateId: rule.template.id,
            recurrenceRuleId: rule.id,
          },
        });

        await prisma.taskAuditLog.create({
          data: {
            taskId: task.id,
            action: "CREATED",
            payload: JSON.stringify({ fromRecurrence: rule.id, generatedDate: dateStr }),
          },
        });

        created++;
      }
    }

    // Update last generated timestamp
    await prisma.taskRecurrenceRule.update({
      where: { id: rule.id },
      data: { lastGeneratedAt: new Date() },
    });
  }

  // Emit analytics
  if (created > 0) {
    const firstRule = rules[0];
    if (firstRule) {
      await prisma.analyticsEvent.create({
        data: {
          businessId: firstRule.businessId,
          type: "recurring_tasks_generated",
          metadataJson: JSON.stringify({ count: created, daysAhead }),
        },
      });
    }
  }

  return created;
}
