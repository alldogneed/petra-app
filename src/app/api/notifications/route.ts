export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowEnd = new Date(todayStart.getTime() + 2 * 24 * 60 * 60 * 1000);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [
      overdueTasks,
      urgentTasks,
      pendingPayments,
      appointments,
      boardingToday,
    ] = await Promise.all([
      // Overdue OPEN tasks
      prisma.task.findMany({
        where: {
          businessId,
          status: "OPEN",
          OR: [
            { dueDate: { lt: todayStart } },
            { dueAt: { lt: now } },
          ],
        },
        select: { id: true, title: true, priority: true, dueDate: true, dueAt: true, category: true },
        orderBy: { priority: "desc" },
        take: 10,
      }),
      // URGENT open tasks (not overdue)
      prisma.task.findMany({
        where: {
          businessId,
          status: "OPEN",
          priority: "URGENT",
          dueDate: { gte: todayStart },
        },
        select: { id: true, title: true, priority: true, dueDate: true, dueAt: true, category: true },
        take: 5,
      }),
      // Pending payments
      prisma.payment.findMany({
        where: { businessId, status: "pending" },
        select: {
          id: true, amount: true, createdAt: true,
          customer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      // Today + tomorrow scheduled appointments
      prisma.appointment.findMany({
        where: {
          businessId,
          status: "scheduled",
          date: { gte: todayStart, lt: tomorrowEnd },
        },
        select: {
          id: true, date: true, startTime: true,
          customer: { select: { id: true, name: true } },
          pet: { select: { name: true } },
          service: { select: { name: true, color: true } },
          priceListItem: { select: { name: true } },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 10,
      }),
      // Boarding check-ins/check-outs today
      prisma.boardingStay.findMany({
        where: {
          businessId,
          status: { in: ["reserved", "checked_in"] },
          OR: [
            { checkIn: { gte: todayStart, lt: tomorrowStart } },
            { checkOut: { gte: todayStart, lt: tomorrowStart } },
          ],
        },
        select: {
          id: true, checkIn: true, checkOut: true, status: true,
          pet: { select: { name: true } },
          room: { select: { name: true } },
        },
        take: 5,
      }),
    ]);

    // Build unified notification items
    const items: {
      type: string;
      id: string;
      title: string;
      subtitle: string;
      critical: boolean;
      meta?: Record<string, unknown>;
    }[] = [];

    const overdueIds = new Set(overdueTasks.map((t) => t.id));

    // 1. Overdue tasks — most critical
    for (const task of overdueTasks) {
      items.push({
        type: "task_overdue",
        id: task.id,
        title: task.title,
        subtitle: `משימה באיחור · ${categoryLabel(task.category)}`,
        critical: true,
        meta: { dueDate: task.dueDate, dueAt: task.dueAt, priority: task.priority },
      });
    }

    // 2. Urgent tasks (not already in overdue)
    for (const task of urgentTasks) {
      if (overdueIds.has(task.id)) continue;
      items.push({
        type: "task_urgent",
        id: task.id,
        title: task.title,
        subtitle: `משימה דחופה · ${categoryLabel(task.category)}`,
        critical: true,
        meta: { dueDate: task.dueDate, priority: task.priority },
      });
    }

    // 3. Pending payments
    for (const payment of pendingPayments) {
      items.push({
        type: "payment",
        id: payment.id,
        title: `תשלום ממתין: ₪${Number(payment.amount).toFixed(0)}`,
        subtitle: payment.customer?.name ?? "לא מזוהה",
        critical: false,
        meta: { amount: payment.amount, createdAt: payment.createdAt },
      });
    }

    // 4. Today's appointments
    for (const appt of appointments) {
      const apptDate = new Date(appt.date);
      const isToday = apptDate.toDateString() === todayStart.toDateString();
      const serviceName = appt.service?.name ?? appt.priceListItem?.name ?? "תור";
      items.push({
        type: "appointment",
        id: appt.id,
        title: `${appt.customer.name}${appt.pet ? ` · ${appt.pet.name}` : ""}`,
        subtitle: `${isToday ? "היום" : "מחר"} ${appt.startTime} · ${serviceName}`,
        critical: false,
        meta: {
          date: appt.date,
          startTime: appt.startTime,
          serviceColor: appt.service?.color,
          isToday,
        },
      });
    }

    // 5. Boarding events today
    for (const stay of boardingToday) {
      const checkInToday = stay.checkIn.toDateString() === todayStart.toDateString();
      const checkOutToday = stay.checkOut?.toDateString() === todayStart.toDateString();
      if (checkInToday && stay.status === "reserved") {
        items.push({
          type: "boarding_checkin",
          id: `ci-${stay.id}`,
          title: `צ'ק-אין היום: ${stay.pet.name}`,
          subtitle: `חדר ${stay.room?.name ?? "לא ידוע"}`,
          critical: false,
          meta: { stayId: stay.id },
        });
      } else if (checkOutToday && stay.status === "checked_in") {
        items.push({
          type: "boarding_checkout",
          id: `co-${stay.id}`,
          title: `צ'ק-אאוט היום: ${stay.pet.name}`,
          subtitle: `חדר ${stay.room?.name ?? "לא ידוע"}`,
          critical: false,
          meta: { stayId: stay.id },
        });
      }
    }

    const criticalCount = items.filter((i) => i.critical).length;

    return NextResponse.json({ items, criticalCount });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת התראות" }, { status: 500 });
  }
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    GENERAL: "כללי",
    BOARDING: "פנסיון",
    TRAINING: "אילוף",
    LEADS: "לידים",
    HEALTH: "בריאות",
    MEDICATION: "תרופות",
    FEEDING: "האכלה",
  };
  return map[cat] ?? cat;
}
