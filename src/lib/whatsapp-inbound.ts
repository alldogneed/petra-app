/**
 * Customer replies to Petra's automatic WhatsApp messages (reminders, confirmations…) that reach
 * the PLATFORM number — DB side. Pure rules + why: src/lib/whatsapp-inbound-rules.ts.
 *
 * Per message (once — claimOnce on Meta's message id):
 *   1. business = the message the customer replied to (context.id) or the last message Petra sent
 *      this phone from the platform number in 30 days (chooseAttribution). None → logged, dropped.
 *   2. customer (or lead) of THAT business only: the ScheduledMessage of that wamid, else the
 *      phone in that business. Nothing of another business is ever read.
 *   3. a task "הלקוח ענה להודעה האוטומטית: …" (HIGH when it looks like a cancel / postpone), or the
 *      text appended to the same open task from the last hour; a bell to the active owners +
 *      managers. "תודה" / "👍" alone → nothing.
 *   4. one short acknowledgement to the customer (≤ 1 per phone per hour), only when the business
 *      sends from the platform number (no active own number — else the reply would come from a
 *      number the customer never wrote to, outside its 24h window).
 * Messages to a business's OWN number (Embedded Signup) are not handled here: that business sees
 * them in its own WhatsApp app / WABA. Never throws.
 */
import prisma from "@/lib/prisma";
import { claimOnce } from "@/lib/rate-limit";
import { maskPhone } from "@/lib/whatsapp-failure";
import { customerContactPhoneOf } from "@/lib/business-contact";
import { findCustomersByPhone, createTask } from "@/services/clients";
import {
  APPEND_WINDOW_MS,
  ATTRIBUTION_WINDOW_MS,
  AUTO_REPLY_THROTTLE_SECONDS,
  autoReplyText,
  chooseAttribution,
  INBOUND_TASK_PREFIX,
  inboundMessageLine,
  inboundPhoneLine,
  inboundTaskTitle,
  isAckOnly,
  isTrustedInbound,
  localPhone,
  looksLikeCancellation,
  phoneVariants,
  type InboundMessage,
} from "@/lib/whatsapp-inbound-rules";

const LOG = "[whatsapp-inbound]";

export function platformPhoneNumberId(): string | null {
  return process.env.META_PHONE_NUMBER_ID?.trim() || null;
}

/** Handle the inbound messages of one webhook change. Never throws. */
export async function handleInboundMessages(
  messages: InboundMessage[],
  phoneNumberId: string | null,
  opts: { signed: boolean } = { signed: true }
): Promise<void> {
  if (!messages.length) return;
  // Unsigned webhook (META_APP_SECRET not set): only replies that quote one of our messages.
  const trusted = messages.filter((m) => isTrustedInbound(m, opts.signed));
  if (trusted.length < messages.length) {
    console.log(`${LOG} ${messages.length - trusted.length} unquoted repl(ies) skipped — set META_APP_SECRET to handle every reply`);
  }
  messages = trusted;
  if (!messages.length) return;
  const platformId = platformPhoneNumberId();
  // Only the platform number: a message to a business's own number belongs to that business's app.
  if (phoneNumberId && platformId && phoneNumberId !== platformId) return;
  if (phoneNumberId && !platformId) {
    const { findBusinessIdByPhoneNumberId } = await import("@/lib/whatsapp-connections");
    if (await findBusinessIdByPhoneNumberId(phoneNumberId)) return;
  }
  for (const m of messages) {
    try {
      if (!(await claimOnce(`wa-inbound:${m.id}`, 7 * 24 * 60 * 60))) continue; // Meta retry
      await handleOne(m, platformId, opts.signed);
    } catch (err) {
      console.error(`${LOG} message failed (${maskPhone(m.from)}):`, err instanceof Error ? err.message : err);
    }
  }
}

async function handleOne(m: InboundMessage, platformId: string | null, signed: boolean): Promise<void> {
  if (isAckOnly(m.text)) return;
  const variants = phoneVariants(m.from);
  const now = new Date();
  const [repliedTo, recent] = await Promise.all([
    m.repliedToWamid
      ? prisma.whatsAppMessageLog.findUnique({
          where: { wamid: m.repliedToWamid },
          select: { businessId: true, toPhone: true, phoneNumberId: true, createdAt: true, wamid: true },
        })
      : Promise.resolve(null),
    // Unsigned: never by phone alone (anyone can name a phone) — only the quoted message counts.
    signed
      ? prisma.whatsAppMessageLog.findMany({
          where: { toPhone: { in: variants }, businessId: { not: null }, createdAt: { gte: new Date(now.getTime() - ATTRIBUTION_WINDOW_MS) } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { businessId: true, toPhone: true, phoneNumberId: true, createdAt: true, wamid: true },
        })
      : Promise.resolve([]),
  ]);
  const owner = chooseAttribution({ from: m.from, platformPhoneNumberId: platformId, repliedTo, recent, now });
  if (!owner) {
    console.log(`${LOG} reply from ${maskPhone(m.from)} matches no business message — dropped`);
    return;
  }
  const { businessId } = owner;

  // The customer / lead — always scoped to this business.
  const scheduled = await prisma.scheduledMessage.findFirst({
    where: { wamid: owner.wamid, businessId },
    select: { customerId: true },
  });
  let customer = scheduled?.customerId
    ? await prisma.customer.findFirst({ where: { id: scheduled.customerId, businessId }, select: { id: true, name: true } })
    : null;
  if (!customer) customer = (await findCustomersByPhone(businessId, prisma, localPhone(m.from)).catch(() => []))[0] ?? null;
  const lead = customer
    ? null
    : await prisma.lead.findFirst({ where: { businessId, phone: { in: variants } }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } });
  const name = customer?.name ?? lead?.name ?? null;
  const urgent = looksLikeCancellation(m.text);

  const taskId = await upsertTask({ businessId, m, name, urgent, customerId: customer?.id ?? null, leadId: lead?.id ?? null, now });
  await bell({ businessId, name, text: m.text, urgent, url: customer ? `/customers/${customer.id}` : taskId ? `/tasks?task=${taskId}` : "/tasks" });
  await acknowledge(m, businessId);
  console.log(`${LOG} reply from ${maskPhone(m.from)} → business ${businessId} (${owner.via}${urgent ? ", cancel/postpone" : ""})`);
}

/** A new task, or the same open task from the last hour with the message appended. */
async function upsertTask(input: {
  businessId: string;
  m: InboundMessage;
  name: string | null;
  urgent: boolean;
  customerId: string | null;
  leadId: string | null;
  now: Date;
}): Promise<string | null> {
  const { businessId, m } = input;
  const phoneLine = inboundPhoneLine(m.from);
  const line = inboundMessageLine(m.at, m.text);
  const open = await prisma.task.findFirst({
    where: {
      businessId,
      status: "OPEN",
      title: { startsWith: INBOUND_TASK_PREFIX },
      description: { contains: phoneLine },
      createdAt: { gte: new Date(input.now.getTime() - APPEND_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, description: true, priority: true },
  });
  if (open) {
    await prisma.task.update({
      where: { id: open.id },
      data: {
        description: `${open.description ?? ""}\n${line}`.slice(0, 5000),
        ...(input.urgent && open.priority !== "URGENT" ? { priority: "HIGH" } : {}),
      },
    });
    return open.id;
  }
  try {
    const task = await createTask(businessId, prisma, {
      title: inboundTaskTitle(m.text, input.name),
      description: [
        "הלקוח ענה בוואטסאפ להודעה אוטומטית של פטרה (תזכורת / אישור). ההודעה לא נשלחת לעסק בשום מקום אחר.",
        phoneLine,
        "",
        line,
      ].join("\n"),
      category: "GENERAL",
      priority: input.urgent ? "HIGH" : "MEDIUM",
      dueAt: input.now.toISOString(),
      ...(input.customerId
        ? { relatedEntityType: "CUSTOMER", relatedEntityId: input.customerId }
        : input.leadId
          ? { relatedEntityType: "LEAD", relatedEntityId: input.leadId }
          : {}),
    });
    return (task as { id?: string } | null)?.id ?? null;
  } catch (err) {
    // Free tier task limit, validation… — the bell below still tells the business.
    console.error(`${LOG} task not created:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Bell for the business's active owners + managers. */
async function bell(input: { businessId: string; name: string | null; text: string; urgent: boolean; url: string }): Promise<void> {
  const members = await prisma.businessUser.findMany({
    where: { businessId: input.businessId, isActive: true, role: { in: ["owner", "manager"] } },
    select: { userId: true },
  });
  if (!members.length) return;
  const who = input.name ?? "לקוח";
  await prisma.notification.createMany({
    data: members.map((u) => ({
      userId: u.userId,
      title: input.urgent ? `${who} מבקש לבטל / לדחות` : `${who} ענה להודעה בוואטסאפ`,
      message: input.text.slice(0, 200),
      actionUrl: input.url,
    })),
  });
}

/**
 * One acknowledgement per phone per hour — free text the customer can receive because they just
 * wrote to this same number. Skipped when the business has its own active number: the reply
 * would leave from that number, where the customer never wrote.
 */
async function acknowledge(m: InboundMessage, businessId: string): Promise<void> {
  const conn = await prisma.whatsAppConnection.findUnique({ where: { businessId }, select: { status: true } }).catch(() => null);
  if (conn?.status === "active") return;
  if (Date.now() - m.at.getTime() > 23 * 60 * 60 * 1000) return; // a very late webhook retry
  if (!(await claimOnce(`wa-inbound-ack:${m.from}`, AUTO_REPLY_THROTTLE_SECONDS))) return;
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true, phone: true, customerContactPhone: true } });
  const { sendWhatsAppMessage } = await import("@/lib/whatsapp");
  const res = await sendWhatsAppMessage({
    to: m.from,
    body: autoReplyText(business?.name ?? null, customerContactPhoneOf(business)),
    businessId,
    context: "inbound_ack",
  });
  if (!res.success) console.error(`${LOG} acknowledgement failed (${maskPhone(m.from)}):`, res.error);
}
