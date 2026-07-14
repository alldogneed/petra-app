/**
 * Scheduled message helpers — create and process WhatsApp reminders.
 */

import prisma from "@/lib/prisma";
import { sendWhatsAppMessage, sendWhatsAppTemplate, interpolateTemplate } from "@/lib/whatsapp";
import { toWhatsAppPhone, formatDate, formatTime } from "@/lib/utils";
import { hasFeatureWithOverrides } from "@/lib/feature-flags";
import { israelDateTime } from "@/lib/reminder-service";

/**
 * True when the event a pre-event reminder points at has already started,
 * was canceled, or no longer exists — sending it now would confuse the customer
 * (the daily/late cron can pick up a reminder hours after its sendAt).
 * Post-event message types (follow-ups, thank-yous, birthdays) return false.
 */
async function isEventExpired(msg: {
  relatedEntityType: string | null;
  relatedEntityId: string | null;
}): Promise<boolean> {
  if (!msg.relatedEntityType || !msg.relatedEntityId) return false;
  const now = new Date();
  try {
    switch (msg.relatedEntityType) {
      case "APPOINTMENT": {
        const appt = await prisma.appointment.findUnique({
          where: { id: msg.relatedEntityId },
          select: { date: true, startTime: true, status: true },
        });
        if (!appt || appt.status === "canceled") return true;
        return israelDateTime(appt.date, appt.startTime) <= now;
      }
      case "TRAINING_SESSION": {
        const s = await prisma.trainingProgramSession.findUnique({
          where: { id: msg.relatedEntityId },
          select: { sessionDate: true, status: true },
        });
        if (!s || s.status === "CANCELED") return true;
        // Date-only sessions (midnight UTC) get end-of-day grace
        const dateOnly = s.sessionDate.getUTCHours() === 0 && s.sessionDate.getUTCMinutes() === 0;
        const cutoff = dateOnly ? new Date(s.sessionDate.getTime() + 24 * 60 * 60 * 1000) : s.sessionDate;
        return cutoff <= now;
      }
      case "GROUP_SESSION": {
        const s = await prisma.trainingGroupSession.findUnique({
          where: { id: msg.relatedEntityId },
          select: { sessionDatetime: true, status: true },
        });
        if (!s || s.status === "CANCELED") return true;
        return s.sessionDatetime <= now;
      }
      case "BOARDING": {
        const stay = await prisma.boardingStay.findUnique({
          where: { id: msg.relatedEntityId },
          select: { checkOut: true },
        });
        if (!stay?.checkOut) return true;
        return stay.checkOut <= now;
      }
      case "SERVICE_DOG_MEETING": {
        const iso = msg.relatedEntityId.split("__")[1];
        return iso ? new Date(iso) <= now : false;
      }
      default:
        return false;
    }
  } catch {
    return false; // on lookup failure, fall through to normal send
  }
}

/**
 * Create a 48-hour WhatsApp reminder for an order.
 * Skips if sendAt would already be in the past.
 */
export async function createOrderReminder(
  orderId: string,
  customerId: string,
  startAt: Date,
  businessId: string
): Promise<void> {
  const sendAt = new Date(startAt.getTime() - 48 * 60 * 60 * 1000);

  if (sendAt <= new Date()) {
    console.log(`[Reminder] Skipping — sendAt ${sendAt.toISOString()} is in the past`);
    return;
  }

  await prisma.scheduledMessage.create({
    data: {
      businessId,
      customerId,
      channel: "whatsapp",
      templateKey: "order_reminder_48h",
      payloadJson: JSON.stringify({ orderId }),
      sendAt,
      status: "PENDING",
      relatedEntityType: "ORDER",
      relatedEntityId: orderId,
    },
  });
}

/**
 * Process up to 50 PENDING scheduled messages whose sendAt <= now.
 * Looks up a MessageTemplate by templateKey, falls back to a Hebrew default.
 * Updates status to SENT or FAILED.
 */
export async function processPendingReminders(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const now = new Date();

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const pending = await prisma.scheduledMessage.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      sendAt: { lte: now, gte: sevenDaysAgo },
    },
    take: 200,
    include: {
      customer: { select: { name: true, phone: true } },
    },
    orderBy: { sendAt: "asc" },
  });

  // Pre-fetch business settings for all unique businessIds
  const businessIds = [...new Set(pending.map((m) => m.businessId))];
  const businesses = await prisma.business.findMany({
    where: { id: { in: businessIds } },
    select: { id: true, whatsappRemindersEnabled: true, tier: true, featureOverrides: true },
  });
  const bizMap = Object.fromEntries(businesses.map((b) => [b.id, b]));

  let sent = 0;
  let failed = 0;

  for (const msg of pending) {
    try {
      // Respect the business's WhatsApp reminders toggle + tier gate
      const biz = bizMap[msg.businessId];
      if (!biz?.whatsappRemindersEnabled) {
        await prisma.scheduledMessage.update({ where: { id: msg.id }, data: { status: "CANCELED" } });
        continue;
      }
      const overrides = (biz.featureOverrides as Record<string, boolean> | null) ?? null;
      if (!hasFeatureWithOverrides(biz.tier, "whatsapp_reminders", overrides)) {
        await prisma.scheduledMessage.update({ where: { id: msg.id }, data: { status: "CANCELED" } });
        continue;
      }

      // Skip reminders whose event already started / was canceled / was deleted
      if (await isEventExpired(msg)) {
        await prisma.scheduledMessage.update({ where: { id: msg.id }, data: { status: "CANCELED" } });
        continue;
      }

      const payload = JSON.parse(msg.payloadJson || "{}");

      // Try to find a matching template
      const template = await prisma.messageTemplate.findFirst({
        where: {
          businessId: msg.businessId,
          channel: "whatsapp",
          isActive: true,
          name: msg.templateKey,
        },
      });

      // Build the message body
      let body: string;

      if (payload.body) {
        // Direct body in payload (appointment reminders, group session reminders, service-dog meeting reminders)
        body = payload.body;
      } else if (template) {
        body = interpolateTemplate(template.body, {
          customerName: msg.customer?.name ?? "",
          orderId: payload.orderId || "",
        });
        // Fetch order details for richer message
        if (payload.orderId) {
          const order = await prisma.order.findUnique({
            where: { id: payload.orderId },
            select: { startAt: true, orderType: true },
          });
          if (order?.startAt) {
            body += `\nתאריך: ${formatDate(order.startAt)}`;
            body += ` שעה: ${formatTime(order.startAt.toTimeString().slice(0, 5))}`;
          }
        }
      } else {
        // Generic Hebrew fallback
        body = `שלום ${msg.customer?.name ?? "לקוח"}, תזכורת מ-Petra. אם יש שאלות, אנחנו כאן!`;
      }

      // Use explicit `to` from payload (service dog recipient reminders) or derive from customer
      const phone = payload.to ?? (msg.customer ? toWhatsAppPhone(msg.customer.phone) : null);
      if (!phone) {
        await prisma.scheduledMessage.update({ where: { id: msg.id }, data: { status: "FAILED" } });
        failed++;
        continue;
      }
      // Prefer Meta template (works outside 24h window); fall back to text
      let result;
      if (payload.metaTemplateName && process.env.META_WHATSAPP_TOKEN) {
        result = await sendWhatsAppTemplate({
          to: phone,
          templateName: payload.metaTemplateName as string,
          bodyParams: (payload.metaTemplateParams as string[]) ?? [],
        });
        // If template fails (e.g. not yet approved), fall back to text
        if (!result.success) {
          console.warn(`[Reminder] Template "${payload.metaTemplateName}" failed, falling back to text`);
          result = await sendWhatsAppMessage({ to: phone, body });
        }
      } else {
        result = await sendWhatsAppMessage({ to: phone, body });
      }

      await prisma.scheduledMessage.update({
        where: { id: msg.id },
        data: {
          status: result.success ? "SENT" : "FAILED",
        },
      });

      if (result.success) sent++;
      else failed++;
    } catch (err) {
      console.error(`[Reminder] Failed to process message ${msg.id}:`, err);
      await prisma.scheduledMessage.update({
        where: { id: msg.id },
        data: { status: "FAILED" },
      });
      failed++;
    }
  }

  return { processed: pending.length, sent, failed };
}
