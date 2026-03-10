export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptStripeSecret } from "@/lib/encryption";
import { constructStripeEvent } from "@/lib/stripe";
import type Stripe from "stripe";

// POST /api/webhooks/stripe
// Handles Stripe checkout.session.completed events.
// Stripe requires the raw body — Next.js App Router provides it via request.text().
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await request.text();

  // Extract businessId from the event metadata before we can load the right webhook secret
  let prelimEvent: Stripe.Event;
  try {
    // Parse without verification first to get the businessId
    prelimEvent = JSON.parse(rawBody) as Stripe.Event;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const metadata =
    (prelimEvent.data?.object as { metadata?: Record<string, string> })?.metadata ?? {};
  const businessId = metadata.businessId;

  if (!businessId) {
    // No businessId in metadata — cannot route this webhook
    console.warn("[Stripe webhook] Missing businessId in metadata, ignoring event");
    return NextResponse.json({ received: true });
  }

  // Load this business's webhook secret (if configured)
  const stripeSettings = await prisma.stripeSettings.findUnique({
    where: { businessId },
    select: { webhookSecretEncrypted: true, status: true },
  });

  // If webhook secret is configured, verify the signature
  if (stripeSettings?.webhookSecretEncrypted) {
    const webhookSecret = decryptStripeSecret(stripeSettings.webhookSecretEncrypted);
    try {
      constructStripeEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      console.error("[Stripe webhook] Signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  // Handle the event
  try {
    const eventType = prelimEvent.type;

    if (eventType === "checkout.session.completed") {
      const session = prelimEvent.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session, businessId);
    }
    // Add more event types here as needed (e.g., payment_intent.payment_failed)

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe webhook] Handler error:", error);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  businessId: string
) {
  const metadata = session.metadata ?? {};
  const customerId = metadata.customerId;
  const appointmentId = metadata.appointmentId;
  const orderId = metadata.orderId;

  const amount = (session.amount_total ?? 0) / 100; // convert from smallest unit
  const currency = session.currency?.toUpperCase() ?? "ILS";

  console.log(`[Stripe webhook] checkout.session.completed — businessId=${businessId} amount=${amount} ${currency}`);

  if (!customerId) {
    // No linked customer — log and skip
    console.warn("[Stripe webhook] No customerId in metadata, skipping Payment record creation");
    return;
  }

  // Verify customer belongs to this business
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    select: { id: true },
  });

  if (!customer) {
    console.warn(`[Stripe webhook] Customer ${customerId} not found for business ${businessId}`);
    return;
  }

  // Create a Payment record
  await prisma.payment.create({
    data: {
      businessId,
      customerId,
      amount,
      method: "credit_card",
      status: "paid",
      notes: `תשלום Stripe — session: ${session.id}`,
      ...(appointmentId ? { appointmentId } : {}),
      ...(orderId ? { orderId } : {}),
      paidAt: new Date(),
    },
  });

  // Update appointment status if linked
  if (appointmentId) {
    await prisma.appointment.updateMany({
      where: { id: appointmentId, businessId },
      data: { status: "confirmed" },
    });
  }

  // Update order status if linked
  if (orderId) {
    await prisma.order.updateMany({
      where: { id: orderId, businessId },
      data: { status: "paid" },
    });
  }

  console.log(`[Stripe webhook] Payment created for customer ${customerId}`);
}
