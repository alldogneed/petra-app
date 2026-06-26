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

  // ─── Step 1: Signature verification ─────────────────────────────────────────
  // Each business has its own Stripe webhook secret, so we need to parse the
  // payload to extract the businessId for secret lookup. This is a minimal,
  // read-only extraction from untrusted data — the ONLY thing we do with it is
  // look up the webhook secret. All business logic uses the verified event below.
  const untrustedBusinessId = extractUntrustedBusinessId(rawBody);

  if (!untrustedBusinessId) {
    // Cannot determine which webhook secret to use — return uniform error
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }

  // Fetch only the webhook secret — nothing else. Use select to minimize exposure.
  const stripeSettings = await prisma.stripeSettings.findUnique({
    where: { businessId: untrustedBusinessId },
    select: { webhookSecretEncrypted: true },
  });

  // Use identical error responses for missing settings vs bad signature
  // to prevent business ID enumeration.
  if (!stripeSettings?.webhookSecretEncrypted) {
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }

  const webhookSecret = decryptStripeSecret(stripeSettings.webhookSecretEncrypted);
  let verifiedEvent: Stripe.Event;
  try {
    verifiedEvent = constructStripeEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[Stripe webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }

  // ─── Step 2: Process verified event only ────────────────────────────────────
  // From here on, ALL data comes from verifiedEvent — never from the untrusted parse.
  try {
    const verifiedMetadata =
      (verifiedEvent.data?.object as { metadata?: Record<string, string> })?.metadata ?? {};
    const businessId = verifiedMetadata.businessId;

    if (!businessId) {
      console.warn("[Stripe webhook] Missing businessId in verified event metadata, ignoring");
      return NextResponse.json({ received: true });
    }

    if (verifiedEvent.type === "checkout.session.completed") {
      const session = verifiedEvent.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session, businessId);
    }
    // Add more event types here as needed (e.g., payment_intent.payment_failed)

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe webhook] Handler error:", error);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}

/**
 * Extract businessId from untrusted raw JSON for webhook secret lookup ONLY.
 * Returns null if the payload is not valid JSON or lacks a businessId.
 * This value must NOT be used for any business logic — only for routing
 * to the correct webhook secret for signature verification.
 */
function extractUntrustedBusinessId(rawBody: string): string | null {
  try {
    const parsed = JSON.parse(rawBody);
    const metadata = parsed?.data?.object?.metadata;
    return typeof metadata?.businessId === "string" ? metadata.businessId : null;
  } catch {
    return null;
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

  // Idempotency: Stripe delivers events at-least-once (retries on non-2xx, and a
  // captured signed body can be replayed). Skip if we already recorded a Payment
  // for this checkout session, so it can't double-credit the order.
  const existingPayment = await prisma.payment.findFirst({
    where: { businessId, notes: { contains: `session: ${session.id}` } },
    select: { id: true },
  });
  if (existingPayment) {
    console.log(`[Stripe webhook] Duplicate checkout.session ${session.id} — Payment already recorded, skipping`);
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
