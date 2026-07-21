/**
 * payment_request automation — sends a WhatsApp payment request IMMEDIATELY when
 * an order becomes payable (unlike reminder-service.ts which schedules for later).
 *
 * Gates (all required): customer phone, business `whatsappRemindersEnabled`,
 * tier via hasFeatureWithOverrides, and an active `payment_request`
 * AutomationRule (opt-in — no rule, no send).
 *
 * Payment link resolution (required — no link, no send):
 *   a) exactly one order line references a PriceListItem with a non-empty
 *      paymentUrl → use it (static link, no webhook — payment must be recorded
 *      manually, see memory: payment-request-order-first)
 *   b) else, active StripeSettings → create a Stripe Checkout session
 *      (same params as POST /api/payments/stripe/payment-link)
 *   c) else skip with a log line.
 *
 * Double-send safety, three layers:
 *   1) POST /api/orders fires only for orders created directly as "confirmed"
 *      (and never for the pay-now flow, which passes suppressPaymentRequest);
 *   2) PATCH /api/orders/[id] fires only after atomically CLAIMING the
 *      draft→confirmed transition via updateMany({where:{status:"draft"}}) —
 *      concurrent confirms can't both claim, and an order created confirmed can
 *      never later claim draft→confirmed;
 *   3) this function skips orders whose paid payments already cover the total,
 *      so even a legitimate re-confirm (draft→confirmed→draft→confirmed) can
 *      never request money that was already collected.
 */

import prisma from "@/lib/prisma";
import { sendWhatsAppMessage, sendWhatsAppTemplate, interpolateTemplate } from "@/lib/whatsapp";
import { toWhatsAppPhone, formatCurrency } from "@/lib/utils";
import { hasFeatureWithOverrides } from "@/lib/feature-flags";
import { decryptStripeSecret } from "@/lib/encryption";
import { createCheckoutSession } from "@/lib/stripe";

export async function sendPaymentRequestForOrder(
  orderId: string,
  businessId: string,
  reason: "order_created" | "order_confirmed" = "order_created"
): Promise<{ sent: boolean } | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    include: {
      lines: { include: { priceListItem: { select: { paymentUrl: true } } } },
      customer: { select: { id: true, name: true, phone: true, email: true } },
      business: { select: { phone: true, tier: true, featureOverrides: true, whatsappRemindersEnabled: true } },
      payments: { select: { amount: true, status: true } },
    },
  });
  if (!order) return null;

  // Never request payment for money already collected — a pay-now order (customer
  // paid at the counter) must not receive a live Stripe link, which would charge
  // them a second time.
  const alreadyPaid = order.payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  if (order.total && alreadyPaid >= order.total) {
    console.log(`[PaymentRequest] order ${orderId} already fully paid, skipping`);
    return null;
  }

  const customer = order.customer;
  if (!customer?.phone?.trim()) return null; // nothing to send to

  // Master toggle + tier gate (same gating as reminder-service.ts)
  const biz = order.business;
  if (!biz?.whatsappRemindersEnabled) return null;
  const overrides = (biz.featureOverrides as Record<string, boolean> | null) ?? null;
  if (!hasFeatureWithOverrides(biz.tier, "whatsapp_reminders", overrides)) return null;

  // Opt-in: requires an active payment_request rule — no rule, no send.
  const rule = await prisma.automationRule.findFirst({
    where: { businessId, trigger: "payment_request", isActive: true },
    include: { template: { select: { body: true } } },
  });
  if (!rule) return null;

  if (!order.total || order.total <= 0) {
    console.log(`[PaymentRequest] order ${orderId} has no positive total, skipping`);
    return null;
  }

  // ── Payment link resolution (required) ─────────────────────────────────────
  let paymentUrl: string | null = null;

  const linesWithStaticUrl = order.lines.filter((l) => l.priceListItem?.paymentUrl?.trim());
  if (linesWithStaticUrl.length === 1) {
    paymentUrl = linesWithStaticUrl[0].priceListItem!.paymentUrl!.trim();
  } else {
    const stripeSettings = await prisma.stripeSettings.findUnique({
      where: { businessId },
      select: { secretKeyEncrypted: true, status: true, currency: true },
    });
    if (stripeSettings && stripeSettings.status === "active") {
      try {
        const secretKey = decryptStripeSecret(stripeSettings.secretKeyEncrypted);
        const result = await createCheckoutSession({
          secretKey,
          amount: order.total,
          currency: stripeSettings.currency || "ILS",
          description: order.lines[0]?.name || "תשלום עבור הזמנה",
          customerEmail: customer.email ?? undefined,
          customerName: customer.name,
          metadata: { businessId, customerId: customer.id, orderId: order.id },
        });
        paymentUrl = result.url;
      } catch (err) {
        console.error("[PaymentRequest] Stripe checkout session creation failed:", err);
        return null;
      }
    }
  }

  if (!paymentUrl) {
    console.log("[PaymentRequest] no payment link available, skipping");
    return null;
  }

  // ── Compose message ────────────────────────────────────────────────────────
  const businessPhone = (biz.phone ?? "").trim();
  const orderTotal = formatCurrency(order.total);
  const serviceName = order.lines[0]?.name ?? "";

  // Pet name — best effort from a linked appointment (the starter body uses {petName})
  let petName = "";
  if (order.relatedEntityType === "Appointment" && order.relatedEntityId) {
    const appt = await prisma.appointment
      .findUnique({ where: { id: order.relatedEntityId }, select: { pet: { select: { name: true } } } })
      .catch(() => null);
    petName = appt?.pet?.name ?? "";
  }

  let body: string;
  if (rule.template?.body) {
    // Placeholder names match the payment_request starter in messages-panel.tsx:
    // {customerName} {serviceName} {petName} {orderTotal} {paymentUrl} {businessPhone}
    body = interpolateTemplate(rule.template.body, {
      customerName: customer.name,
      serviceName,
      petName,
      orderTotal,
      paymentUrl,
      businessPhone,
    });
  } else {
    const forPart = [serviceName, petName].filter(Boolean).join(" – ");
    body = `שלום ${customer.name}! 🐾\n\n*דרישת תשלום*${forPart ? `\nעבור: ${forPart}` : ""}\n\n💰 סה"כ לתשלום: *${orderTotal}*\n\n💳 לתשלום מאובטח לחצו כאן:\n${paymentUrl}\n\nתודה שבחרתם בנו! 😊${businessPhone ? `\n_לפניות ושאלות: ${businessPhone}_` : ""}`;
  }

  // ── Send immediately (mirrors the inline confirmation pattern in the orders
  //    route): Meta template first (works outside the 24h window) when the
  //    business phone param is non-empty, free-form fallback on failure. ──────
  const to = toWhatsAppPhone(customer.phone);
  if (!to) return null;

  let sent = false;
  if (businessPhone) {
    try {
      const res = await sendWhatsAppTemplate({
        to,
        templateName: "petra_payment_request",
        bodyParams: [customer.name, serviceName || "ההזמנה", orderTotal, paymentUrl, businessPhone],
      });
      if (res.success) {
        sent = true;
      } else {
        console.warn("[PaymentRequest] template send failed, falling back to text");
        const fallback = await sendWhatsAppMessage({ to, body });
        sent = fallback.success;
      }
    } catch (err) {
      console.error("[PaymentRequest] template send threw, falling back to text:", err);
      const fallback = await sendWhatsAppMessage({ to, body }).catch(() => ({ success: false }));
      sent = fallback.success;
    }
  } else {
    // Meta rejects empty params — no business phone means free-form only
    const res = await sendWhatsAppMessage({ to, body });
    sent = res.success;
  }

  console.log(`[PaymentRequest] order ${orderId} (${reason}): ${sent ? "sent" : "failed"}`);
  return { sent };
}
