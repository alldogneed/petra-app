/**
 * WhatsApp messaging service.
 *
 * Priority:
 * 1. Meta Cloud API
 *    a. the business's OWN number — when `businessId` is passed and the business has an
 *       active WhatsAppConnection (Embedded Signup) and, for templates, the template is
 *       APPROVED on its WABA. Resolved by resolveWhatsAppSender() (src/lib/whatsapp-connections.ts).
 *       An auth failure on a business number flags that connection and retries once via the
 *       platform number so the customer still gets the message.
 *    b. the platform number — META_WHATSAPP_TOKEN + META_PHONE_NUMBER_ID (unchanged default
 *       for every business without a connection).
 * 2. Twilio WhatsApp — set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM
 * 3. Stub mode — console.log (no credentials set)
 */

import type { WaSender } from "./whatsapp-connections";

// Loaded lazily (like prisma below) so importing this module stays cheap for callers
// that end up in Twilio/stub mode and never touch the DB.
async function connections() {
  return import("./whatsapp-connections");
}

interface SendResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

interface SendParams {
  to: string; // WhatsApp-ready digits e.g. "972501234567"
  body: string;
  templateSid?: string;
  context?: string; // free-form origin tag for the message log (e.g. "lead_alert")
  businessId?: string | null; // send on behalf of this business (its own number when connected, else platform)
}

export interface MetaTemplateMessage {
  to: string;          // WhatsApp-ready digits e.g. "972501234567"
  templateName: string; // Approved Meta template name e.g. "petra_appointment_reminder"
  languageCode?: string; // default "he"
  bodyParams: string[]; // positional {{1}}, {{2}} … body component variables
  context?: string; // free-form origin tag for the message log (e.g. "lead_alert")
  businessId?: string | null; // send on behalf of this business (its own number when connected, else platform)
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
// Message log — every API send gets a row; the statuses webhook
// (/api/webhooks/whatsapp-status) updates it to sent/delivered/failed.
// Fire-and-forget: logging must never break sending.
// ---------------------------------------------------------------------------

async function logOutboundMessage(entry: {
  wamid: string;
  toPhone: string;
  kind: "template" | "text";
  templateName?: string;
  context?: string;
  businessId?: string | null; // business the message was sent on behalf of
  phoneNumberId?: string | null; // Meta phone_number_id it was sent FROM (business or platform)
}): Promise<void> {
  try {
    const { default: prisma } = await import("@/lib/prisma");
    await prisma.whatsAppMessageLog.create({
      data: {
        wamid: entry.wamid,
        toPhone: entry.toPhone,
        kind: entry.kind,
        templateName: entry.templateName ?? null,
        context: entry.context ?? null,
        businessId: entry.businessId ?? null,
        phoneNumberId: entry.phoneNumberId ?? null,
      },
    });
  } catch (err) {
    console.error("[WhatsApp] message log write failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Meta Cloud API — shared send path (business number or platform number)
// ---------------------------------------------------------------------------

const META_MESSAGES_API = "https://graph.facebook.com/v19.0";

/** Meta error code: template name does not exist on this WABA (stale templatesJson) */
const META_ERR_TEMPLATE_MISSING = 132001;

interface MetaSendMeta {
  kind: "text" | "template";
  to: string;
  templateName?: string;
  context?: string;
  businessId?: string | null;
  logLabel: string; // console prefix
  alertContext: string; // passed to maybeAlertAuthFailure (platform token only)
}

interface MetaAttempt extends SendResult {
  authError?: boolean;
  templateMissing?: boolean;
}

/** One POST /messages with the given sender. Logs the outbound row on success. Never throws. */
async function postMetaMessage(sender: WaSender, payload: unknown, meta: MetaSendMeta): Promise<MetaAttempt> {
  const url = `${META_MESSAGES_API}/${sender.phoneNumberId}/messages`;
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
      console.error(`[${meta.logLabel}] Send failed (${sender.source}):`, errMsg);
      const authError = isAuthError(res.status, data.error);
      // The owner alert is about the PLATFORM token — a business token dying is surfaced
      // on that business's connection instead (see sendViaMeta).
      if (sender.source === "platform") await maybeAlertAuthFailure(meta.alertContext, res.status, data.error);
      return {
        success: false,
        error: errMsg,
        authError,
        templateMissing: data.error?.code === META_ERR_TEMPLATE_MISSING,
      };
    }

    const msgId = data.messages?.[0]?.id ?? `${meta.kind === "template" ? "META_TMPL" : "META"}_${Date.now()}`;
    await logOutboundMessage({
      wamid: msgId,
      toPhone: meta.to,
      kind: meta.kind,
      templateName: meta.templateName,
      context: meta.context,
      businessId: meta.businessId ?? sender.businessId ?? null,
      phoneNumberId: sender.phoneNumberId,
    });
    return { success: true, messageSid: msgId };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`[${meta.logLabel}] Send error (${sender.source}):`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Resolve the sender for this business and send. When the BUSINESS number fails with an
 * auth error (dead/revoked token) the connection is flagged "error" and the message is
 * retried once from the platform number; same retry for a template missing on the business
 * WABA (stale sync). Returns null only when no Meta credentials exist at all (stub path).
 */
async function sendViaMeta(payload: unknown, meta: MetaSendMeta): Promise<SendResult | null> {
  const { resolveWhatsAppSender, markWhatsAppConnectionError } = await connections();
  const sender = await resolveWhatsAppSender(meta.businessId, meta.templateName ? { templateName: meta.templateName } : undefined);
  if (!sender) return null;

  const first = await postMetaMessage(sender, payload, meta);
  if (first.success || sender.source !== "business") {
    return { success: first.success, messageSid: first.messageSid, error: first.error };
  }

  if (first.authError && sender.businessId) {
    await markWhatsAppConnectionError(sender.businessId, `שגיאת הרשאה מול Meta: ${first.error ?? "unknown"}`.slice(0, 500));
  }
  if (first.authError || first.templateMissing) {
    const platform = await resolveWhatsAppSender(null);
    if (platform) {
      console.warn(`[${meta.logLabel}] business sender failed (${first.authError ? "auth" : "template missing"}) — retrying via platform number`);
      const retry = await postMetaMessage(platform, payload, meta);
      return { success: retry.success, messageSid: retry.messageSid, error: retry.error };
    }
  }
  return { success: false, error: first.error };
}

async function sendViaMetaCloudApi(params: SendParams): Promise<SendResult | null> {
  const payload = {
    messaging_product: "whatsapp",
    to: params.to,
    type: "text",
    text: { body: params.body },
  };
  return sendViaMeta(payload, {
    kind: "text",
    to: params.to,
    context: params.context,
    businessId: params.businessId,
    logLabel: "WhatsApp Meta",
    alertContext: "WhatsApp text message",
  });
}

// ---------------------------------------------------------------------------
// Meta Cloud API — Template messages (proactive / outside 24h window)
// ---------------------------------------------------------------------------

async function sendViaMetaCloudApiTemplate(params: MetaTemplateMessage): Promise<SendResult | null> {
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
  return sendViaMeta(payload, {
    kind: "template",
    to: params.to,
    templateName: params.templateName,
    context: params.context,
    businessId: params.businessId,
    logLabel: "WhatsApp Meta Template",
    alertContext: "WhatsApp template message",
  });
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
 * Uses Meta Cloud API if credentials are set, then Twilio, then stub mode.
 */
export async function sendWhatsAppMessage(params: SendParams): Promise<SendResult> {
  const { to, body } = params;

  // 1. Try Meta Cloud API
  const metaResult = await sendViaMetaCloudApi(params);
  if (metaResult !== null) return metaResult;

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
 * Falls back to text message if Meta credentials are not configured.
 */
export async function sendWhatsAppTemplate(params: MetaTemplateMessage): Promise<SendResult> {
  // 1. Try Meta template API
  const metaResult = await sendViaMetaCloudApiTemplate(params);
  if (metaResult !== null) return metaResult;

  // 2. Fallback: send as plain text (Twilio / stub) so something always goes out
  const body = params.bodyParams.join(" | ");
  return sendWhatsAppMessage({ to: params.to, body, context: params.context, businessId: params.businessId });
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
