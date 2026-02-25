/**
 * WhatsApp messaging service.
 * Uses Twilio WhatsApp API in production, console.log stub in dev.
 *
 * Env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
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

// Lazy-initialized Twilio client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _twilioClient: any = null;

function getTwilioClient() {
  if (!_twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) return null;

    try {
      // Dynamic import to avoid build errors when twilio isn't installed
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

/**
 * Send a WhatsApp message via Twilio, or log to console in dev/stub mode.
 */
export async function sendWhatsAppMessage(params: SendParams): Promise<SendResult> {
  const { to, body } = params;
  const client = getTwilioClient();
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

  if (!client) {
    // Stub mode — log and return success
    console.log(`[WhatsApp STUB] To: ${to} | Body: ${body.slice(0, 100)}...`);
    return { success: true, messageSid: `STUB_${Date.now()}` };
  }

  try {
    const message = await client.messages.create({
      from: `whatsapp:${from}`,
      to: `whatsapp:+${to}`,
      body,
    });
    return { success: true, messageSid: message.sid };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[WhatsApp] Send failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
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
