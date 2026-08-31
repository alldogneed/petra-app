/**
 * WhatsApp messaging service.
 *
 * Priority:
 * 1. Meta Cloud API — set META_WHATSAPP_TOKEN + META_PHONE_NUMBER_ID
 * 2. Twilio WhatsApp — set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM
 * 3. Stub mode — console.log (no credentials set)
 *
 * Per-business numbers (Meta Embedded Signup): pass `businessId` and the send is
 * routed through resolveWhatsAppSender() — the business's own connected number when
 * its connection is active (and, for templates, the template is APPROVED on its
 * WABA), otherwise the platform number exactly as before. An auth failure on a
 * business sender flips the connection to "error" and retries once via the
 * platform sender. Every Meta API send is logged to WhatsAppMessageLog (the
 * statuses webhook updates delivery state by wamid).
 */

import {
  resolveWhatsAppSender,
  markWhatsAppConnectionError,
  type WaSender,
} from "./whatsapp-connections";

interface SendResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

interface SendParams {
  to: string; // WhatsApp-ready digits e.g. "972501234567"
  body: string;
  templateSid?: string;
  /** Route through this business's connected number when active (platform fallback otherwise). */
  businessId?: string | null;
  /** Caller tag stored on WhatsAppMessageLog, e.g. "appointment_reminder". */
  context?: string;
}

export interface MetaTemplateMessage {
  to: string;          // WhatsApp-ready digits e.g. "972501234567"
  templateName: string; // Approved Meta template name e.g. "petra_appointment_reminder"
  languageCode?: string; // default "he"
  bodyParams: string[]; // positional {{1}}, {{2}} … body component variables
  /** Route through this business's connected number when the template is APPROVED there. */
  businessId?: string | null;
  /** Caller tag stored on WhatsAppMessageLog. */
  context?: string;
}

// ---------------------------------------------------------------------------
// Auth-failure detection → owner alert (so a dead token doesn't go unnoticed)
// ---------------------------------------------------------------------------

type MetaError = { message?: string; code?: number; type?: string };

/** True only for token/auth failures — NOT per-recipient errors (24h window, opt-out, etc.) */
function isAuthError(status: number, error?: MetaError): boolean {
  if (status === 401) return true;
  if (error?.code === 190) return true;            // OAuthException: expired/invalid token
  if (error?.type === "OAuthException") return true;
  const m = (error?.message ?? "").toLowerCase();
  return m.includes("access token") || m.includes("malformed") || m.includes("expired token") || m.includes("oauthexception");
}

/** If the failure is an auth/token problem, email the owner (throttled). Awaited so it isn't killed on Vercel. */
async function maybeAlertAuthFailure(context: string, status: number, error?: MetaError): Promise<void> {
  if (!isAuthError(status, error)) return;
  try {
    const { notifyOwnerWhatsAppDown } = await import("./notify-owner");
    await notifyOwnerWhatsAppDown(context, error?.message ?? `HTTP ${status}`);
  } catch (e) {
    console.error("[WhatsApp] failed to send auth-failure alert:", e);
  }
}

// ---------------------------------------------------------------------------
// WhatsAppMessageLog — every Meta API send is recorded (webhook updates status)
// ---------------------------------------------------------------------------

async function logMetaSend(entry: {
  wamid: string;
  to: string;
  kind: "text" | "template";
  templateName?: string;
  context?: string;
  sender: WaSender;
  requestedBusinessId?: string | null;
}): Promise<void> {
  try {
    const { prisma } = await import("./prisma");
    await prisma.whatsAppMessageLog.create({
      data: {
        wamid: entry.wamid,
        toPhone: entry.to,
        kind: entry.kind,
        templateName: entry.templateName ?? null,
        context: entry.context ?? null,
        // Attribute to the requesting business even on platform-number sends,
        // so per-business delivery history is complete either way.
        businessId: entry.sender.businessId ?? entry.requestedBusinessId ?? null,
        phoneNumberId: entry.sender.phoneNumberId,
      },
    });
  } catch (err) {
    // Logging must never fail the send (duplicate wamid on a retry included).
    console.error("[WhatsApp] message log write failed:", err instanceof Error ? err.message : err);
  }
}

/** Business-sender auth failure → flag the connection so the UI shows it and the resolver skips it. */
async function handleBusinessSenderAuthFailure(sender: WaSender, error?: MetaError, httpStatus?: number): Promise<void> {
  if (sender.source !== "business" || !sender.businessId) return;
  if (!isAuthError(httpStatus ?? 0, error)) return;
  await markWhatsAppConnectionError(
    sender.businessId,
    `אימות מול Meta נכשל: ${error?.message ?? `HTTP ${httpStatus}`}`
  );
}

// ---------------------------------------------------------------------------
// Meta Cloud API
// ---------------------------------------------------------------------------

async function sendViaMetaWithSender(params: SendParams, sender: WaSender): Promise<SendResult> {
  const url = `https://graph.facebook.com/v19.0/${sender.phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: params.to,
    type: "text",
    text: { body: params.body },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sender.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as {
      messages?: Array<{ id: string }>;
      error?: MetaError;
    };

    if (!res.ok || data.error) {
      const errMsg = data.error?.message ?? `HTTP ${res.status}`;
      console.error(`[WhatsApp Meta] Send failed (${sender.source}):`, errMsg);
      if (sender.source === "business") {
        await handleBusinessSenderAuthFailure(sender, data.error, res.status);
      } else {
        await maybeAlertAuthFailure("WhatsApp text message", res.status, data.error);
      }
      return { success: false, error: errMsg };
    }

    const msgId = data.messages?.[0]?.id ?? `META_${Date.now()}`;
    await logMetaSend({
      wamid: msgId,
      to: params.to,
      kind: "text",
      context: params.context,
      sender,
      requestedBusinessId: params.businessId,
    });
    return { success: true, messageSid: msgId };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[WhatsApp Meta] Send error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// Meta Cloud API — Template messages (proactive / outside 24h window)
// ---------------------------------------------------------------------------

async function sendViaMetaTemplateWithSender(params: MetaTemplateMessage, sender: WaSender): Promise<SendResult> {
  const url = `https://graph.facebook.com/v19.0/${sender.phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: params.to,
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.languageCode ?? "he" },
      ...(params.bodyParams.length > 0 && {
        components: [
          {
            type: "body",
            parameters: params.bodyParams.map((text) => ({ type: "text", text })),
          },
        ],
      }),
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${sender.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as {
      messages?: Array<{ id: string }>;
      error?: MetaError;
    };

    if (!res.ok || data.error) {
      const errMsg = data.error?.message ?? `HTTP ${res.status}`;
      console.error(`[WhatsApp Meta Template] Send failed (${sender.source}):`, errMsg);
      if (sender.source === "business") {
        await handleBusinessSenderAuthFailure(sender, data.error, res.status);
      } else {
        await maybeAlertAuthFailure("WhatsApp template message", res.status, data.error);
      }
      return { success: false, error: errMsg };
    }

    const msgId = data.messages?.[0]?.id ?? `META_TMPL_${Date.now()}`;
    await logMetaSend({
      wamid: msgId,
      to: params.to,
      kind: "template",
      templateName: params.templateName,
      context: params.context,
      sender,
      requestedBusinessId: params.businessId,
    });
    return { success: true, messageSid: msgId };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[WhatsApp Meta Template] Send error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// Twilio (fallback)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _twilioClient: any = null;

function getTwilioClient() {
  if (!_twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) return null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const twilio = require("twilio");
      _twilioClient = twilio(sid, token);
    } catch {
      console.warn("twilio package not installed — using stub mode");
      return null;
    }
  }
  return _twilioClient;
}

async function sendViaTwilio(params: SendParams): Promise<SendResult | null> {
  const client = getTwilioClient();
  if (!client) return null;

  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

  try {
    const message = await client.messages.create({
      from: `whatsapp:${from}`,
      to: `whatsapp:+${params.to}`,
      body: params.body,
    });
    return { success: true, messageSid: message.sid };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[WhatsApp Twilio] Send failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a WhatsApp message.
 * Routes through the business's connected number when `businessId` is passed and
 * the connection is active; otherwise Meta platform number, then Twilio, then stub.
 */
export async function sendWhatsAppMessage(params: SendParams): Promise<SendResult> {
  const { to, body } = params;

  // 1. Meta Cloud API (business sender when available, else platform)
  const sender = await resolveWhatsAppSender(params.businessId);
  if (sender) {
    const result = await sendViaMetaWithSender(params, sender);
    // Business-sender failure → one retry via the platform number so the message still goes out.
    if (!result.success && sender.source === "business") {
      const platform = await resolveWhatsAppSender(null);
      if (platform) return sendViaMetaWithSender(params, platform);
    }
    return result;
  }

  // 2. Try Twilio
  const twilioResult = await sendViaTwilio(params);
  if (twilioResult !== null) return twilioResult;

  // 3. Stub mode
  console.log(`[WhatsApp STUB] To: ${to} | Body: ${body.slice(0, 100)}...`);
  return { success: true, messageSid: `STUB_${Date.now()}` };
}

/**
 * Send a WhatsApp message using an approved Meta template.
 * Works outside the 24-hour customer service window (proactive outbound).
 * Uses the business's own number only when the template is APPROVED on its WABA.
 * Falls back to text message if Meta credentials are not configured.
 */
export async function sendWhatsAppTemplate(params: MetaTemplateMessage): Promise<SendResult> {
  // 1. Meta template API (business sender only if the template is approved there)
  const sender = await resolveWhatsAppSender(params.businessId, { templateName: params.templateName });
  if (sender) {
    const result = await sendViaMetaTemplateWithSender(params, sender);
    if (!result.success && sender.source === "business") {
      const platform = await resolveWhatsAppSender(null);
      if (platform) return sendViaMetaTemplateWithSender(params, platform);
    }
    return result;
  }

  // 2. Fallback: send as plain text (Twilio / stub) so something always goes out
  const body = params.bodyParams.join(" | ");
  return sendWhatsAppMessage({ to: params.to, body, businessId: params.businessId, context: params.context });
}

/**
 * Replace {key} placeholders in a template body with provided values.
 * Sanitizes variable values to prevent template injection (user-supplied
 * content containing {placeholders} that could leak other variable values).
 */
export function interpolateTemplate(
  body: string,
  vars: Record<string, string>
): string {
  // Sanitize values: strip curly braces to prevent recursive interpolation
  const safeVars: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    safeVars[k] = v.replace(/[{}]/g, "");
  }
  return body.replace(/\{(\w+)\}/g, (match, key) => safeVars[key] ?? match);
}
