export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/cron/service-dog-alerts
 * Daily cron — creates Tasks + SystemMessages for:
 *   1. Medical protocols due within 14 days (or already overdue)
 *   2. Active SERVICE_DOG training programs with no session in 14+ days
 *   3. Pending compliance events overdue for notification
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in14Days = new Date(today.getTime() + 14 * DAY_MS);
    const ago14Days = new Date(today.getTime() - 14 * DAY_MS);

    let tasksCreated = 0;
    let sysCreated = 0;
    let skipped = 0;

    // ── 1. Medical protocol alerts ────────────────────────────────────────────
    const protocols = await prisma.serviceDogMedicalProtocol.findMany({
      where: {
        status: { in: ["PENDING", "OVERDUE"] },
        OR: [
          { status: "OVERDUE" },
          { dueDate: { lte: in14Days } },
        ],
      },
      include: {
        serviceDog: {
          include: { pet: { select: { name: true } } },
        },
      },
    });

    for (const proto of protocols) {
      const businessId = proto.businessId;
      const dogName = proto.serviceDog.pet.name;
      const isOverdue = proto.status === "OVERDUE" || (proto.dueDate ? proto.dueDate < today : false);
      const daysUntil = proto.dueDate
        ? Math.round((proto.dueDate.getTime() - today.getTime()) / DAY_MS)
        : 0;
      const formattedDate = proto.dueDate
        ? proto.dueDate.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })
        : "לא ידוע";

      const taskEntityId = `sd-medical-${proto.id}`;

      // Task
      const existingTask = await prisma.task.findFirst({
        where: { businessId, relatedEntityType: "SERVICE_DOG", relatedEntityId: taskEntityId, status: "OPEN" },
      });
      if (!existingTask) {
        const priority = isOverdue || daysUntil <= 3 ? "URGENT" : daysUntil <= 7 ? "HIGH" : "MEDIUM";
        const title = isOverdue
          ? `פרוטוקול רפואי באיחור — ${dogName}`
          : `פרוטוקול רפואי מתקרב — ${dogName}`;
        const description = isOverdue
          ? `${proto.protocolLabel} של ${dogName} עבר את מועד הביצוע (${formattedDate}). יש לטפל בהקדם.`
          : `${proto.protocolLabel} של ${dogName} יגיע לביצוע ב-${formattedDate} (בעוד ${daysUntil} ימים).`;

        await prisma.task.create({
          data: {
            businessId,
            title,
            description,
            category: "HEALTH",
            priority,
            status: "OPEN",
            dueDate: proto.dueDate ?? undefined,
            relatedEntityType: "SERVICE_DOG",
            relatedEntityId: taskEntityId,
          },
        });
        tasksCreated++;
      } else {
        skipped++;
      }

      // SystemMessage (only for overdue or ≤7 days)
      if (isOverdue || daysUntil <= 7) {
        const sysEntityId = `sys-sd-medical-${proto.id}`;
        const existingSys = await prisma.systemMessage.findFirst({
          where: { businessId, actionLabel: sysEntityId },
        });
        if (!existingSys) {
          const title = isOverdue
            ? `פרוטוקול רפואי באיחור: ${dogName}`
            : `פרוטוקול רפואי עומד לפוג: ${dogName}`;
          const content = isOverdue
            ? `${proto.protocolLabel} של ${dogName} עבר את המועד (${formattedDate})`
            : `${proto.protocolLabel} של ${dogName} יגיע ב-${formattedDate} (${daysUntil} ימים)`;

          await prisma.systemMessage.create({
            data: {
              businessId,
              title,
              content,
              type: isOverdue ? "error" : "warning",
              icon: "shield",
              actionUrl: `/service-dogs/${proto.serviceDogId}`,
              actionLabel: sysEntityId,
              expiresAt: new Date(today.getTime() + 14 * DAY_MS),
            },
          });
          sysCreated++;
        } else {
          skipped++;
        }
      }
    }

    // ── 2. Training gap alerts ────────────────────────────────────────────────
    const activePrograms = await prisma.trainingProgram.findMany({
      where: {
        trainingType: "SERVICE_DOG",
        status: "ACTIVE",
      },
      include: {
        dog: { select: { id: true, name: true } },
        sessions: {
          where: { status: "COMPLETED" },
          orderBy: { sessionDate: "desc" },
          take: 1,
        },
      },
    });

    const stalePrograms = activePrograms.filter((p) => {
      const last = p.sessions[0];
      if (!last) return true; // never had a session
      return new Date(last.sessionDate) < ago14Days;
    });

    for (const prog of stalePrograms) {
      const businessId = prog.businessId;
      const dogName = prog.dog.name;
      const lastSession = prog.sessions[0];
      const daysSince = lastSession
        ? Math.floor((now.getTime() - new Date(lastSession.sessionDate).getTime()) / DAY_MS)
        : null;

      const taskEntityId = `sd-training-gap-${prog.id}`;
      const existingTask = await prisma.task.findFirst({
        where: { businessId, relatedEntityType: "SERVICE_DOG", relatedEntityId: taskEntityId, status: "OPEN" },
      });

      if (!existingTask) {
        const title = `פער באימון כלב שירות — ${dogName}`;
        const description = daysSince !== null
          ? `תוכנית האימון של ${dogName} פעילה אך לא התקיים אימון ב-${daysSince} ימים.`
          : `תוכנית האימון של ${dogName} פעילה אך טרם התקיים אף אימון.`;

        await prisma.task.create({
          data: {
            businessId,
            title,
            description,
            category: "TRAINING",
            priority: daysSince !== null && daysSince > 21 ? "HIGH" : "MEDIUM",
            status: "OPEN",
            relatedEntityType: "SERVICE_DOG",
            relatedEntityId: taskEntityId,
          },
        });
        tasksCreated++;
      } else {
        skipped++;
      }
    }

    // ── 3. Compliance event alerts ────────────────────────────────────────────
    const overdueCompliance = await prisma.serviceDogComplianceEvent.findMany({
      where: {
        notificationStatus: "PENDING",
        notificationDue: { lt: today },
      },
      include: {
        serviceDog: {
          include: { pet: { select: { name: true } } },
        },
      },
    });

    for (const evt of overdueCompliance) {
      const businessId = evt.businessId;
      const dogName = evt.serviceDog.pet.name;
      const taskEntityId = `sd-compliance-${evt.id}`;

      const existingTask = await prisma.task.findFirst({
        where: { businessId, relatedEntityType: "SERVICE_DOG", relatedEntityId: taskEntityId, status: "OPEN" },
      });

      if (!existingTask) {
        const formattedDue = evt.notificationDue
          ? evt.notificationDue.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })
          : "לא ידוע";

        await prisma.task.create({
          data: {
            businessId,
            title: `דיווח עמידה ממתין — ${dogName}`,
            description: `${evt.eventDescription ?? evt.eventType} של ${dogName} מחכה לדיווח. המועד היה ${formattedDue}.`,
            category: "GENERAL",
            priority: "URGENT",
            status: "OPEN",
            relatedEntityType: "SERVICE_DOG",
            relatedEntityId: taskEntityId,
          },
        });
        tasksCreated++;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({
      ok: true,
      tasksCreated,
      sysCreated,
      skipped,
      medicalAlerts: protocols.length,
      trainingGaps: stalePrograms.length,
      complianceOverdue: overdueCompliance.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("CRON service-dog-alerts error:", error);
    return NextResponse.json({ error: "Failed to process service dog alerts" }, { status: 500 });
  }
}
