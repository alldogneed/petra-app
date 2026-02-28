export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptInvoicingSecret } from "@/lib/encryption";
import { verifyMorningWebhookSignature } from "@/lib/invoicing/providers/morning";
import { maskSensitive, logInvoicing } from "@/lib/invoicing/logger";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/webhooks/invoices — PUBLIC endpoint for invoice provider webhooks
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Rate limit: 100 per minute per IP
  const rl = rateLimit("invoice_webhook", ip, { max: 100, windowMs: 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const signature = request.headers.get("x-webhook-signature") ?? "";
  const provider = request.headers.get("x-webhook-provider") ?? "morning";

  logInvoicing("info", "Webhook received", { provider, ip });

  // Find provider settings to get webhook secret
  const settings = await prisma.invoicingSettings.findFirst({
    where: { providerName: provider, webhookSecretEncrypted: { not: null } },
    select: { businessId: true, webhookSecretEncrypted: true },
  });

  // Reject if no webhook secret is configured — prevents processing unauthenticated webhooks
  if (!settings?.webhookSecretEncrypted) {
    logInvoicing("warn", "Webhook rejected: no secret configured for provider", { provider, ip });
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  let signatureValid = false;

  if (settings.webhookSecretEncrypted && signature) {
    try {
      const secret = decryptInvoicingSecret(settings.webhookSecretEncrypted);

      switch (provider) {
        case "morning":
          signatureValid = verifyMorningWebhookSignature(rawBody, signature, secret);
          break;
        default:
          logInvoicing("warn", "Unknown provider for webhook verification", { provider });
      }
    } catch (err) {
      logInvoicing("error", "Webhook signature verification error", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Parse payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    await logWebhook(provider, "parse_error", "{}", signatureValid, "Invalid JSON payload", ip);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = (payload.event as string) ?? (payload.type as string) ?? "unknown";

  // Mask sensitive data before storing
  const maskedPayload = JSON.stringify(maskSensitive(payload));

  // Log the webhook
  await logWebhook(provider, eventType, maskedPayload, signatureValid, null, ip);

  if (!signatureValid) {
    logInvoicing("warn", "Invalid webhook signature", { provider, ip });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Process the webhook event
  try {
    await processWebhookEvent(provider, eventType, payload);
  } catch (err) {
    logInvoicing("error", "Webhook processing error", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Still return 200 to prevent retries for processing errors
  }

  return NextResponse.json({ received: true });
}

async function processWebhookEvent(
  provider: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Handle document status updates
  const providerDocId = (payload.document_id ?? payload.documentId ?? payload.id) as string | undefined;

  if (!providerDocId) return;

  switch (eventType) {
    case "document.created":
    case "document.finalized": {
      await prisma.invoiceDocument.updateMany({
        where: { providerDocId, providerName: provider },
        data: {
          status: "issued",
          documentNumber: (payload.document_number ?? payload.number) as string | undefined,
          documentUrl: (payload.document_url ?? payload.url) as string | undefined,
        },
      });
      break;
    }
    case "document.cancelled":
    case "document.canceled": {
      await prisma.invoiceDocument.updateMany({
        where: { providerDocId, providerName: provider },
        data: { status: "cancelled" },
      });
      break;
    }
    case "document.failed": {
      await prisma.invoiceDocument.updateMany({
        where: { providerDocId, providerName: provider },
        data: {
          status: "failed",
          failureReason: (payload.error ?? payload.reason) as string | undefined,
        },
      });
      break;
    }
  }
}

async function logWebhook(
  provider: string,
  eventType: string,
  payloadJson: string,
  signatureValid: boolean,
  errorMessage: string | null,
  ip: string | null
): Promise<void> {
  try {
    await prisma.invoiceWebhookLog.create({
      data: {
        provider,
        eventType,
        payloadJson,
        signatureValid,
        errorMessage,
        ip,
      },
    });
  } catch (err) {
    logInvoicing("error", "Failed to log webhook", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
