/**
 * Support tickets — every DB write of a ticket goes through here so the
 * handling history (SupportTicketEvent) and the SLA columns never drift.
 *
 * Customer side = the business member who opened the ticket (+ the business owner,
 * who sees every ticket of the business). Staff side = Petra platform team (/owner/support).
 * No $transaction (PgBouncer) — writes are sequential; the ticket row is the source of truth.
 */
import prisma from "@/lib/prisma";
import { ServiceError } from "./types";
import {
  isCustomerVisibleEvent,
  isOverdue,
  waitingSince,
  type SupportTicketStatus,
} from "@/lib/support-tickets";
import { sendSupportTicketEmail, sendSupportReplyEmail } from "@/lib/email";
import { notifyOwnerSupportActivity, notifyOwnerSupportOverdue } from "@/lib/notify-owner";

export { ServiceError };

const APP_URL = () => process.env.APP_URL ?? "https://petra-app.com";

export interface Actor {
  userId: string;
  name: string | null;
  email?: string | null;
}

const eventSelect = {
  id: true,
  type: true,
  authorType: true,
  authorName: true,
  body: true,
  fromStatus: true,
  toStatus: true,
  createdAt: true,
} as const;

/** Never throws — a failed alert must not fail the request that triggered it. */
async function quietly(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    console.error(`[support] ${label} failed:`, err);
  }
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createSupportTicket(input: {
  businessId: string;
  actor: Actor;
  title: string;
  description: string;
  pageUrl: string | null;
  screenshotBase64?: string | null;
}) {
  const now = new Date();
  const ticket = await prisma.supportTicket.create({
    data: {
      businessId: input.businessId,
      userId: input.actor.userId,
      title: input.title,
      description: input.description,
      pageUrl: input.pageUrl,
      status: "open",
      lastCustomerMessageAt: now,
    },
  });
  await prisma.supportTicketEvent.create({
    data: {
      ticketId: ticket.id,
      type: "created",
      authorType: "customer",
      authorUserId: input.actor.userId,
      authorName: input.actor.name,
      body: null, // the description lives on the ticket itself
      toStatus: "open",
      createdAt: now,
    },
  });

  const business = await prisma.business.findUnique({ where: { id: input.businessId }, select: { name: true } });
  const businessName = business?.name ?? input.businessId;
  const adminUrl = `${APP_URL()}/owner/support?ticket=${ticket.id}`;
  await Promise.all([
    quietly("ticket email", () =>
      sendSupportTicketEmail({
        ticketId: ticket.id,
        businessName,
        userEmail: input.actor.email ?? "",
        title: ticket.title,
        description: ticket.description,
        pageUrl: ticket.pageUrl,
        adminUrl,
        screenshotBase64: input.screenshotBase64 ?? null,
      })
    ),
    quietly("owner alert", () =>
      notifyOwnerSupportActivity({ kind: "new", businessName, userEmail: input.actor.email ?? "", title: ticket.title, adminUrl })
    ),
  ]);
  return ticket;
}

// ─── Customer side ───────────────────────────────────────────────────────────

export interface CustomerScope {
  businessId: string;
  userId: string;
  /** Business owner (or impersonating platform admin) sees every ticket of the business. */
  seesAllOfBusiness: boolean;
}

function customerWhere(scope: CustomerScope) {
  return scope.seesAllOfBusiness
    ? { businessId: scope.businessId }
    : { businessId: scope.businessId, userId: scope.userId };
}

export async function listCustomerTickets(scope: CustomerScope) {
  const tickets = await prisma.supportTicket.findMany({
    where: customerWhere(scope),
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      lastStaffReplyAt: true,
      customerUnread: true,
      userId: true,
      user: { select: { name: true } },
    },
  });
  return {
    tickets: tickets.map(({ userId, user, ...t }) => ({
      ...t,
      openedByMe: userId === scope.userId,
      openedBy: user?.name ?? null,
    })),
    unreadCount: tickets.filter((t) => t.customerUnread && t.userId === scope.userId).length,
  };
}

export async function getCustomerTicket(scope: CustomerScope, id: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, ...customerWhere(scope) },
    select: {
      id: true,
      title: true,
      description: true,
      pageUrl: true,
      status: true,
      createdAt: true,
      userId: true,
      customerUnread: true,
      user: { select: { name: true } },
      events: { orderBy: { createdAt: "asc" }, select: eventSelect },
    },
  });
  if (!ticket) throw new ServiceError("הפנייה לא נמצאה", "NOT_FOUND");

  // Opening the ticket = the reply was read (only for the person who opened it).
  if (ticket.customerUnread && ticket.userId === scope.userId) {
    await prisma.supportTicket.updateMany({ where: { id: ticket.id }, data: { customerUnread: false } });
  }

  const { userId, user, events, customerUnread: _u, ...rest } = ticket;
  return {
    ...rest,
    openedByMe: userId === scope.userId,
    openedBy: user?.name ?? null,
    events: events
      .filter((e) => isCustomerVisibleEvent(e.type))
      // The customer sees "צוות פטרה", never the individual staff member's name.
      .map((e) => (e.authorType === "staff" ? { ...e, authorName: "צוות פטרה" } : e)),
  };
}

export async function addCustomerReply(scope: CustomerScope, id: string, actor: Actor, body: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, ...customerWhere(scope) },
    select: { id: true, status: true, title: true, business: { select: { name: true } } },
  });
  if (!ticket) throw new ServiceError("הפנייה לא נמצאה", "NOT_FOUND");

  const now = new Date();
  await prisma.supportTicketEvent.create({
    data: { ticketId: id, type: "customer_reply", authorType: "customer", authorUserId: actor.userId, authorName: actor.name, body, createdAt: now },
  });
  const reopened = ticket.status === "resolved";
  if (reopened) {
    await prisma.supportTicketEvent.create({
      data: { ticketId: id, type: "status_change", authorType: "system", fromStatus: "resolved", toStatus: "open", createdAt: new Date(now.getTime() + 1) },
    });
  }
  await prisma.supportTicket.update({
    where: { id },
    data: {
      lastCustomerMessageAt: now,
      slaAlertedAt: null,
      ...(reopened ? { status: "open", resolvedAt: null } : {}),
    },
  });

  await quietly("owner alert", () =>
    notifyOwnerSupportActivity({
      kind: reopened ? "reopened" : "reply",
      businessName: ticket.business?.name ?? "",
      userEmail: actor.email ?? "",
      title: ticket.title,
      body,
      adminUrl: `${APP_URL()}/owner/support?ticket=${id}`,
    })
  );
  return { reopened };
}

// ─── Staff side (/owner/support) ─────────────────────────────────────────────

export async function listStaffTickets(filter: { status?: SupportTicketStatus | null }) {
  const [rows, grouped] = await Promise.all([
    prisma.supportTicket.findMany({
      where: filter.status ? { status: filter.status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        description: true,
        pageUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastCustomerMessageAt: true,
        lastStaffReplyAt: true,
        firstResponseAt: true,
        business: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, name: true } },
        _count: { select: { events: true } },
      },
    }),
    prisma.supportTicket.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const now = new Date();
  const tickets = rows
    .map((t) => {
      const since = waitingSince(t);
      return { ...t, waitingSince: since, overdue: isOverdue(t, now) };
    })
    // Waiting for us first (oldest wait on top), then the rest newest first.
    .sort((a, b) => {
      if (a.waitingSince && b.waitingSince) return a.waitingSince.getTime() - b.waitingSince.getTime();
      if (a.waitingSince) return -1;
      if (b.waitingSince) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  const counts = { open: 0, in_progress: 0, resolved: 0 } as Record<string, number>;
  for (const g of grouped) counts[g.status] = g._count._all;
  const awaiting = await countAwaitingStaff();
  return { tickets, counts, awaiting };
}

/** Tickets whose last word is the customer's — the number on the "תמיכה" menu item. */
export async function countAwaitingStaff(): Promise<{ total: number; overdue: number }> {
  const open = await prisma.supportTicket.findMany({
    where: { status: { not: "resolved" } },
    select: { status: true, lastCustomerMessageAt: true, lastStaffReplyAt: true, createdAt: true },
  });
  const now = new Date();
  let total = 0;
  let overdue = 0;
  for (const t of open) {
    if (!waitingSince(t)) continue;
    total++;
    if (isOverdue(t, now)) overdue++;
  }
  return { total, overdue };
}

export async function getStaffTicket(id: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      pageUrl: true,
      status: true,
      createdAt: true,
      lastCustomerMessageAt: true,
      lastStaffReplyAt: true,
      firstResponseAt: true,
      resolvedAt: true,
      customerUnread: true,
      business: { select: { id: true, name: true, phone: true } },
      user: { select: { id: true, email: true, name: true } },
      events: { orderBy: { createdAt: "asc" }, select: eventSelect },
    },
  });
  if (!ticket) throw new ServiceError("הפנייה לא נמצאה", "NOT_FOUND");
  return { ...ticket, waitingSince: waitingSince(ticket), overdue: isOverdue(ticket) };
}

async function recordStatusChange(ticketId: string, from: string, to: SupportTicketStatus, actor: Actor, at: Date) {
  if (from === to) return;
  await prisma.supportTicketEvent.create({
    data: { ticketId, type: "status_change", authorType: "staff", authorUserId: actor.userId, authorName: actor.name, fromStatus: from, toStatus: to, createdAt: at },
  });
}

function statusData(to: SupportTicketStatus, at: Date) {
  return { status: to, resolvedAt: to === "resolved" ? at : null };
}

export async function setStaffTicketStatus(id: string, to: SupportTicketStatus, actor: Actor) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!ticket) throw new ServiceError("הפנייה לא נמצאה", "NOT_FOUND");
  const now = new Date();
  await recordStatusChange(id, ticket.status, to, actor, now);
  return prisma.supportTicket.update({ where: { id }, data: statusData(to, now), select: { id: true, status: true } });
}

/**
 * A staff reply (sent to the customer: email + "הודעות מפטרה" envelope) or an
 * internal note (staff only). A reply moves an `open` ticket to `in_progress`
 * unless `status` says otherwise (e.g. "reply and close").
 */
export async function addStaffMessage(
  id: string,
  actor: Actor,
  input: { body: string; internal: boolean; status?: SupportTicketStatus | null }
) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      title: true,
      businessId: true,
      firstResponseAt: true,
      user: { select: { email: true, name: true } },
    },
  });
  if (!ticket) throw new ServiceError("הפנייה לא נמצאה", "NOT_FOUND");

  const now = new Date();
  await prisma.supportTicketEvent.create({
    data: {
      ticketId: id,
      type: input.internal ? "internal_note" : "staff_reply",
      authorType: "staff",
      authorUserId: actor.userId,
      authorName: actor.name,
      body: input.body,
      createdAt: now,
    },
  });

  const nextStatus: SupportTicketStatus | null =
    input.status ?? (!input.internal && ticket.status === "open" ? "in_progress" : null);
  if (nextStatus) await recordStatusChange(id, ticket.status, nextStatus, actor, new Date(now.getTime() + 1));

  await prisma.supportTicket.update({
    where: { id },
    data: {
      ...(nextStatus ? statusData(nextStatus, now) : {}),
      ...(input.internal
        ? {}
        : {
            lastStaffReplyAt: now,
            firstResponseAt: ticket.firstResponseAt ?? now,
            customerUnread: true,
            slaAlertedAt: null,
          }),
    },
  });

  let emailSent: boolean | null = null;
  if (!input.internal) {
    const ticketUrl = `${APP_URL()}/support?ticket=${id}`;
    // In-app: the business's "הודעות מפטרה" envelope. Business-wide by design — it
    // names the ticket title only; the reply itself is behind the ticket's access rule.
    await quietly("system message", () =>
      prisma.systemMessage.create({
        data: {
          businessId: ticket.businessId,
          title: "התקבלה תשובה לפנייה שלך",
          content: `צוות פטרה ענה לפנייה "${ticket.title.slice(0, 120)}". לחצו כדי לקרוא את התשובה ולהשיב.`,
          type: "info",
          actionUrl: `/support?ticket=${id}`,
          actionLabel: "לצפייה בתשובה",
        },
      })
    );
    if (ticket.user?.email) {
      emailSent = await sendSupportReplyEmail({
        to: ticket.user.email,
        name: ticket.user.name,
        ticketTitle: ticket.title,
        reply: input.body,
        resolved: nextStatus === "resolved",
        ticketUrl,
      })
        .then(() => true)
        .catch((err) => {
          console.error("[support] reply email failed:", err);
          return false;
        });
    }
  }
  return { status: nextStatus ?? ticket.status, emailSent };
}

// ─── SLA monitor (cron) ──────────────────────────────────────────────────────

/**
 * Alert the platform owner about tickets waiting on us past SUPPORT_SLA_HOURS.
 * A ticket is alerted once per waiting period (slaAlertedAt is cleared by any
 * new reply in either direction).
 */
export async function runSupportSlaCheck(now: Date = new Date()) {
  const candidates = await prisma.supportTicket.findMany({
    where: { status: { not: "resolved" }, slaAlertedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      lastCustomerMessageAt: true,
      lastStaffReplyAt: true,
      business: { select: { name: true } },
    },
  });
  const overdue = candidates.filter((t) => isOverdue(t, now));
  if (overdue.length === 0) return { alerted: 0 };

  await notifyOwnerSupportOverdue({
    tickets: overdue.map((t) => ({
      title: t.title,
      businessName: t.business?.name ?? "",
      waitingSince: waitingSince(t)!,
    })),
    adminUrl: `${APP_URL()}/owner/support`,
  });
  await prisma.supportTicket.updateMany({
    where: { id: { in: overdue.map((t) => t.id) } },
    data: { slaAlertedAt: now },
  });
  return { alerted: overdue.length };
}
