/**
 * Stripe helpers for per-business payment collection.
 *
 * Each business stores their own Stripe secret key (encrypted) in StripeSettings.
 * We create Stripe Checkout Sessions so customers can pay online.
 *
 * Env var: STRIPE_ENCRYPTION_KEY — 64-char hex key for AES-256-GCM (openssl rand -hex 32)
 */

import Stripe from "stripe";

// ─── Client factory ──────────────────────────────────────────────────────────

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: "2025-02-24.acacia" as any,
    typescript: true,
  });
}

// ─── Verify API key by fetching account info ─────────────────────────────────

export async function verifyStripeKey(
  secretKey: string
): Promise<{ valid: boolean; accountId?: string; error?: string }> {
  try {
    const stripe = createStripeClient(secretKey);
    const account = await stripe.accounts.retrieve();
    return { valid: true, accountId: account.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "שגיאה לא ידועה";
    // Treat auth errors specially
    if (message.includes("Invalid API Key") || message.includes("No such API key")) {
      return { valid: false, error: "מפתח API לא תקין" };
    }
    return { valid: false, error: message };
  }
}

// ─── Payment link creation ───────────────────────────────────────────────────

export interface CreatePaymentLinkParams {
  secretKey: string;
  amount: number;       // In ILS (e.g. 250.00)
  currency: string;     // e.g. "ILS"
  description: string;  // line-item name shown to customer
  customerEmail?: string;
  customerName?: string;
  metadata?: Record<string, string>;
  successUrl?: string;
  cancelUrl?: string;
}

export interface PaymentLinkResult {
  sessionId: string;
  url: string;
}

export async function createCheckoutSession(
  params: CreatePaymentLinkParams
): Promise<PaymentLinkResult> {
  const stripe = createStripeClient(params.secretKey);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: {
            name: params.description,
          },
          unit_amount: Math.round(params.amount * 100), // smallest currency unit
        },
        quantity: 1,
      },
    ],
    customer_email: params.customerEmail || undefined,
    metadata: {
      ...params.metadata,
    },
    success_url:
      params.successUrl ||
      `${appUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:
      params.cancelUrl ||
      `${appUrl}/payment-cancelled`,
  });

  return { sessionId: session.id, url: session.url! };
}

// ─── Webhook signature verification ─────────────────────────────────────────

export function constructStripeEvent(
  payload: string,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return Stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
