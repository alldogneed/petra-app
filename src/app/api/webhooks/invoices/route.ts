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
  const rawProvider = request.headers.get("x-webhook-provider") ?? "morning";

  // Validate provider against allowlist to prevent unbounded strings in DB queries/logs
  const VALID_PROVIDERS = ["morning"] as const;
  const provider = VALID_PROVIDERS.includes(rawProvider as typeof VALID_PROVIDERS[number])
    ? rawProvider
    : null;
  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  logInvoicing("info", "Webhook received", { provider, ip });

  // Find ALL businesses with this provider configured (multi-tenant HMAC matching).
  // Each business has its own webhook secret, so we try signature verification against
  // each one — the matching secret identifies the correct tenant.
  const allSettings = await prisma.invoicingSettings.findMany({
    where: { providerName: provider, webhookSecretEncrypted: { not: null } },
    select: { businessId: true, webhookSecretEncrypted: true },
  });

  // Reject if no webhook secret is configured — prevents processing unauthenticated webhooks
  if (allSettings.length === 0) {
    logInvoicing("warn", "Webhook rejected: no secret configured for provider", { provider, ip });
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  // Try to verify the signature against each business's secret to find the correct tenant
  let matchedSettings: { businessId: string; webhookSecretEncrypted: string } | null = null;

  if (signature) {
    for (const settings of allSettings) {
      try {
        const secret = decryptInvoicingSecret(settings.webhookSecretEncrypted!);
        let valid = false;

        switch (provider) {
          case "morning":
            valid = verifyMorningWebhookSignature(rawBody, signature, secret);
            break;
          default:
            logInvoicing("warn", "Unknown provider for webhook verification", { provider });
        }

        if (valid) {
          matchedSettings = settings as { businessId: string; webhookSecretEncrypted: string };
          break;
        }
      } catch (err) {
        logInvoicing("error", "Webhook signature verification error", {
          businessId: settings.businessId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Parse payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    await logWebhook(provider, "parse_error", "{}", false, "Invalid JSON payload", ip);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = (payload.event as string) ?? (payload.type as string) ?? "unknown";

  if (!matchedSettings) {
    logInvoicing("warn", "Invalid webhook signature — no matching business found", {
      provider,
      ip,
      businessCount: allSettings.length,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Log the webhook only after signature is verified (prevents DB fill by unsigned requests)
  const maskedPayload = JSON.stringify(maskSensitive(payload));
  await logWebhook(provider, eventType, maskedPayload, true, null, ip);

  // Process the webhook event scoped to the matched business
  try {
    await processWebhookEvent(provider, eventType, payload, matchedSettings.businessId);
  } catch (err) {
    logInvoicing("error", "Webhook processing error", {
      businessId: matchedSettings.businessId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Still return 200 to prevent retries for processing errors
  }

  return NextResponse.json({ received: true });
}

async function processWebhookEvent(
  provider: string,
  eventType: string,
  payload: Record<string, unknown>,
  businessId: string
): Promise<void> {
  // Handle document status updates — scoped to the verified business
  const providerDocId = (payload.document_id ?? payload.documentId ?? payload.id) as string | undefined;

  if (!providerDocId) return;

  switch (eventType) {
    case "document.created":
    case "document.finalized": {
      await prisma.invoiceDocument.updateMany({
        where: { providerDocId, providerName: provider, businessId },
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
        where: { providerDocId, providerName: provider, businessId },
        data: { status: "cancelled" },
      });
      break;
    }
    case "document.failed": {
      await prisma.invoiceDocument.updateMany({
        where: { providerDocId, providerName: provider, businessId },
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
