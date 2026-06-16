/**
 * Notifications service — message templates, system messages, user notifications,
 * scheduled messages, and business notification aggregation.
 *
 * All functions are business-scoped (businessId first param).
 * No Request/Response knowledge. Throws ServiceError on failure.
 *
 * Side effects that stay in routes:
 *   - rateLimit (creation endpoints)
 *   - logCurrentUserActivity (template creation)
 *   - WhatsApp/email dispatch (scheduled-messages send route stays as-is)
 */

import type { DbClient } from "./supabase";
import { ServiceError } from "./types";

export { ServiceError };
export type { DbClient };

// ─── Message Templates ────────────────────────────────────────────────────

export async function listMessageTemplates(
  businessId: string,
  db: DbClient,
  opts: { channel?: string | null } = {}
) {
  const where: Record<string, unknown> = { businessId };
  if (opts.channel) where.channel = opts.channel;

  return db.messageTemplate.findMany({
    where: where as any,
    include: {
      automationRules: {
        select: { id: true, trigger: true, triggerOffset: true, isActive: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createMessageTemplate(
  businessId: string,
  db: DbClient,
  input: {
    name: string;
    channel?: string | null;
    subject?: string | null;
    body: string;
    variables?: string | null;
  }
) {
  const { name, channel, subject, body: templateBody, variables } = input;

  if (!name || typeof name !== "string" || !name.trim()) {
    throw new ServiceError("שדה שם חובה", "VALIDATION");
  }
  if (name.length > 200) {
    throw new ServiceError("שם תבנית ארוך מדי (מקסימום 200 תווים)", "VALIDATION");
  }
  if (!templateBody || typeof templateBody !== "string" || !templateBody.trim()) {
    throw new ServiceError("שדה תוכן הודעה חובה", "VALIDATION");
  }
  if (templateBody.length > 10000) {
    throw new ServiceError("תוכן הודעה ארוך מדי (מקסימום 10000 תווים)", "VALIDATION");
  }
  if (subject && typeof subject === "string" && subject.length > 500) {
    throw new ServiceError("נושא ארוך מדי (מקסימום 500 תווים)", "VALIDATION");
  }

  return db.messageTemplate.create({
    data: {
      businessId,
      name,
      ...(channel !== undefined && { channel }),
      ...(subject !== undefined && { subject }),
      body: templateBody,
      variables: variables || "[]",
    } as any,
  });
}

export async function updateMessageTemplate(
  businessId: string,
  db: DbClient,
  id: string,
  data: {
    name?: string;
    channel?: string | null;
    subject?: string | null;
    body?: string;
    variables?: string | null;
  }
) {
  const existing = await db.messageTemplate.findFirst({ where: { id, businessId } });
  if (!existing) throw new ServiceError("Message template not found", "NOT_FOUND");

  const { name, channel, subject, body: templateBody, variables } = data;

  // Length validation (match createMessageTemplate)
  if (name !== undefined) {
    if (!name || typeof name !== "string" || !name.trim()) throw new ServiceError("שדה שם חובה", "VALIDATION");
    if (name.length > 200) throw new ServiceError("שם תבנית ארוך מדי (מקסימום 200 תווים)", "VALIDATION");
  }
  if (templateBody !== undefined) {
    if (!templateBody || typeof templateBody !== "string" || !templateBody.trim()) throw new ServiceError("שדה תוכן הודעה חובה", "VALIDATION");
    if (templateBody.length > 10000) throw new ServiceError("תוכן הודעה ארוך מדי (מקסימום 10000 תווים)", "VALIDATION");
  }
  if (subject && typeof subject === "string" && subject.length > 500) throw new ServiceError("נושא ארוך מדי (מקסימום 500 תווים)", "VALIDATION");

  return db.messageTemplate.update({
    where: { id, businessId },
    data: {
      ...(name !== undefined && { name }),
      ...(channel !== undefined && { channel }),
      ...(subject !== undefined && { subject }),
      ...(templateBody !== undefined && { body: templateBody }),
      ...(variables !== undefined && { variables }),
    } as any,
  });
}

export async function deleteMessageTemplate(businessId: string, db: DbClient, id: string) {
  const existing = await db.messageTemplate.findFirst({ where: { id, businessId } });
  if (!existing) throw new ServiceError("Message template not found", "NOT_FOUND");

  await db.automationRule.deleteMany({ where: { templateId: id, businessId } });
  await db.messageTemplate.deleteMany({ where: { id, businessId } });
}

// ─── System Messages ──────────────────────────────────────────────────────

export async function listSystemMessages(
  businessId: string,
  db: DbClient,
  opts: { unreadOnly?: boolean; all?: boolean } = {}
) {
  const where: Record<string, unknown> = {
    businessId,
    ...(opts.unreadOnly ? { isRead: false } : {}),
    ...(opts.all ? {} : { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }),
  };

  const [messages, unreadCount] = await Promise.all([
    db.systemMessage.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.systemMessage.count({
      where: {
        businessId,
        isRead: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    }),
  ]);

  return { messages, unreadCount };
}

export async function createSystemMessage(
  businessId: string,
  db: DbClient,
  input: {
    title: string;
    content: string;
    type?: string;
    icon?: string | null;
    actionUrl?: string | null;
    actionLabel?: string | null;
    expiresAt?: string | null;
  }
) {
  const { title, content, type, icon, actionUrl, actionLabel, expiresAt } = input;

  if (!title || typeof title !== "string" || title.length > 500) {
    throw new ServiceError("כותרת חובה (מקסימום 500 תווים)", "VALIDATION");
  }
  if (!content || typeof content !== "string" || content.length > 5000) {
    throw new ServiceError("תוכן חובה (מקסימום 5000 תווים)", "VALIDATION");
  }
  if (actionLabel && (typeof actionLabel !== "string" || actionLabel.length > 200)) {
    throw new ServiceError("תווית כפתור ארוכה מדי (מקסימום 200 תווים)", "VALIDATION");
  }
  if (actionUrl?.trim()) {
    const trimmed = actionUrl.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      throw new ServiceError("actionUrl must start with http:// or https://", "VALIDATION");
    }
  }

  return db.systemMessage.create({
    data: {
      businessId,
      title,
      content,
      type: type || "info",
      icon: icon || null,
      actionUrl: actionUrl || null,
      actionLabel: actionLabel || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });
}

export async function updateSystemMessage(
  businessId: string,
  db: DbClient,
  id: string,
  data: Record<string, unknown>
) {
  const existing = await db.systemMessage.findFirst({ where: { id, businessId } });
  if (!existing) throw new ServiceError("Message not found", "NOT_FOUND");

  const update: Record<string, unknown> = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.content !== undefined) update.content = data.content;
  if (data.type !== undefined) update.type = data.type;
  if (data.icon !== undefined) update.icon = data.icon;
  if (data.actionUrl !== undefined) update.actionUrl = data.actionUrl;
  if (data.actionLabel !== undefined) update.actionLabel = data.actionLabel;
  if (data.isRead !== undefined) update.isRead = data.isRead;
  if (data.expiresAt !== undefined) update.expiresAt = data.expiresAt ? new Date(data.expiresAt as string) : null;

  return db.systemMessage.update({ where: { id, businessId }, data: update as any });
}

export async function markSystemMessageRead(businessId: string, db: DbClient, id: string) {
  const existing = await db.systemMessage.findFirst({ where: { id, businessId } });
  if (!existing) throw new ServiceError("Message not found", "NOT_FOUND");
  return db.systemMessage.update({ where: { id }, data: { isRead: true } });
}

export async function markAllSystemMessagesRead(businessId: string, db: DbClient) {
  await db.systemMessage.updateMany({
    where: { businessId, isRead: false },
    data: { isRead: true },
  });
}

export async function deleteSystemMessage(businessId: string, db: DbClient, id: string) {
  const existing = await db.systemMessage.findFirst({ where: { id, businessId } });
  if (!existing) throw new ServiceError("Message not found", "NOT_FOUND");
  await db.systemMessage.delete({ where: { id, businessId } });
}

export async function deleteAllSystemMessages(businessId: string, db: DbClient) {
  await db.systemMessage.deleteMany({ where: { businessId } });
}

// ─── User Notifications ───────────────────────────────────────────────────

export async function listUserNotifications(userId: string, db: DbClient) {
  const notifications = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      title: true,
      message: true,
      isRead: true,
      actionUrl: true,
      createdAt: true,
    },
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  return { notifications, unreadCount };
}

export async function markUserNotificationRead(userId: string, db: DbClient, id: string) {
  const updated = await db.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });
  if (updated.count === 0) throw new ServiceError("Not found", "NOT_FOUND");
}

export async function deleteUserNotification(userId: string, db: DbClient, id: string) {
  await db.notification.deleteMany({ where: { id, userId } });
}

export async function markAllUserNotificationsRead(userId: string, db: DbClient) {
  await db.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

// ─── Scheduled Messages ───────────────────────────────────────────────────

export async function listScheduledMessages(
  businessId: string,
  db: DbClient,
  opts: { status?: string | null; page?: number } = {}
) {
  const take = 50;
  const page = Math.max(1, opts.page ?? 1);
  const skip = (page - 1) * take;

  const where: Record<string, unknown> = {
    businessId,
    ...(opts.status && opts.status !== "ALL" ? { status: opts.status } : {}),
  };

  const [messages, total] = await Promise.all([
    db.scheduledMessage.findMany({
      where: where as any,
      include: { customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { sendAt: "desc" },
      take,
      skip,
    }),
    db.scheduledMessage.count({ where: where as any }),
  ]);

  return { messages, total, page, pages: Math.ceil(total / take) };
}

export async function cancelScheduledMessage(businessId: string, db: DbClient, id: string) {
  const existing = await db.scheduledMessage.findFirst({ where: { id, businessId } });
  if (!existing) throw new ServiceError("לא נמצא", "NOT_FOUND");
  if (existing.status !== "PENDING") {
    throw new ServiceError("ניתן לבטל רק הודעות ממתינות", "VALIDATION");
  }

  return db.scheduledMessage.update({
    where: { id, businessId },
    data: { status: "CANCELED" },
  });
}

// ─── Business Notifications Aggregation ──────────────────────────────────

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

export async function getBusinessNotifications(businessId: string, db: DbClient) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowEnd = new Date(todayStart.getTime() + 2 * 24 * 60 * 60 * 1000);

  const [overdueTasks, urgentTasks, pendingPayments, appointments, boardingToday] =
    await Promise.all([
      db.task.findMany({
        where: {
          businessId,
          status: "OPEN",
          OR: [{ dueDate: { lt: todayStart } }, { dueAt: { lt: now } }],
        },
        select: { id: true, title: true, priority: true, dueDate: true, dueAt: true, category: true },
        orderBy: { priority: "desc" },
        take: 10,
      }),
      db.task.findMany({
        where: {
          businessId,
          status: "OPEN",
          priority: "URGENT",
          dueDate: { gte: todayStart },
        },
        select: { id: true, title: true, priority: true, dueDate: true, dueAt: true, category: true },
        take: 5,
      }),
      db.payment.findMany({
        where: { businessId, status: "pending" },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          customer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.appointment.findMany({
        where: {
          businessId,
          status: "scheduled",
          date: { gte: todayStart, lt: tomorrowEnd },
        },
        select: {
          id: true,
          date: true,
          startTime: true,
          customer: { select: { id: true, name: true } },
          pet: { select: { name: true } },
          service: { select: { name: true, color: true } },
          priceListItem: { select: { name: true } },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 10,
      }),
      db.boardingStay.findMany({
        where: {
          businessId,
          status: { in: ["reserved", "checked_in"] },
          OR: [
            { checkIn: { gte: todayStart, lt: tomorrowStart } },
            { checkOut: { gte: todayStart, lt: tomorrowStart } },
          ],
        },
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
          status: true,
          pet: { select: { name: true } },
          room: { select: { name: true } },
        },
        take: 5,
      }),
    ]);

  const items: {
    type: string;
    id: string;
    title: string;
    subtitle: string;
    critical: boolean;
    meta?: Record<string, unknown>;
  }[] = [];

  const overdueIds = new Set(overdueTasks.map((t) => t.id));

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
  return { items, criticalCount };
}
