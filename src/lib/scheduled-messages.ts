/**
 * Scheduled message helpers — create and process WhatsApp reminders.
 */

import prisma from "@/lib/prisma";
import { sendWhatsAppMessage, interpolateTemplate } from "@/lib/whatsapp";
import { toWhatsAppPhone, formatDate, formatTime } from "@/lib/utils";

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

  const pending = await prisma.scheduledMessage.findMany({
    where: {
      status: "PENDING",
      sendAt: { lte: now },
    },
    take: 50,
    include: {
      customer: { select: { name: true, phone: true } },
    },
    orderBy: { sendAt: "asc" },
  });

  let sent = 0;
  let failed = 0;

  for (const msg of pending) {
    try {
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
      if (template) {
        body = interpolateTemplate(template.body, {
          customerName: msg.customer.name,
          orderId: payload.orderId || "",
        });
      } else {
        // Hebrew fallback
        body = `שלום ${msg.customer.name}, תזכורת: יש לך הזמנה שמתחילה בעוד 48 שעות. אם יש שאלות, אנחנו כאן!`;
      }

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

      const phone = toWhatsAppPhone(msg.customer.phone);
      const result = await sendWhatsAppMessage({ to: phone, body });

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
