/**
 * WhatsApp messaging service.
 *
 * Priority:
 * 1. Meta Cloud API — set META_WHATSAPP_TOKEN + META_PHONE_NUMBER_ID
 * 2. Twilio WhatsApp — set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM
 * 3. Stub mode — console.log (no credentials set)
 */

interface SendResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

interface SendParams {
  to: string; // WhatsApp-ready digits e.g. "972501234567"
  body: string;
  templateSid?: string;
}

// ---------------------------------------------------------------------------
// Meta Cloud API
// ---------------------------------------------------------------------------

async function sendViaMetaCloudApi(params: SendParams): Promise<SendResult | null> {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) return null;

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

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
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as {
      messages?: Array<{ id: string }>;
      error?: { message: string };
    };

    if (!res.ok || data.error) {
      const errMsg = data.error?.message ?? `HTTP ${res.status}`;
      console.error("[WhatsApp Meta] Send failed:", errMsg);
      return { success: false, error: errMsg };
    }

    const msgId = data.messages?.[0]?.id ?? `META_${Date.now()}`;
    return { success: true, messageSid: msgId };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[WhatsApp Meta] Send error:", errorMessage);
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
 * Replace {key} placeholders in a template body with provided values.
 */
export function interpolateTemplate(
  body: string,
  vars: Record<string, string>
): string {
  return body.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}
