/**
 * Per-business WhatsApp connections (Meta Embedded Signup + coexistence).
 *
 * CONTRACT — implemented in this file; consumed by:
 *   - src/lib/whatsapp.ts               → resolveWhatsAppSender()
 *   - src/app/api/integrations/whatsapp/* → connect / status / disconnect / sync-templates
 *   - src/app/api/webhooks/whatsapp-status → findBusinessIdByPhoneNumberId()
 *   - settings UI (via the API routes above)
 *
 * Platform fallback: when a business has no ACTIVE connection (or the requested template is
 * not APPROVED on its WABA), callers keep sending from the platform number exactly as today.
 */

export type WaSenderSource = "business" | "platform";

export interface WaSender {
  token: string;
  phoneNumberId: string;
  source: WaSenderSource;
  /** Set when source === "business" */
  connectionId?: string;
  businessId?: string;
}

export interface WaConnectionStatus {
  connected: boolean;
  status: "active" | "disconnected" | "error" | "none";
  displayPhone: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  coexistence: boolean;
  connectedAt: string | null;
  templatesSyncedAt: string | null;
  /** { templateName: "APPROVED" | "PENDING" | ... } on the business WABA */
  templates: Record<string, string>;
  /** Platform-approved template names the business WABA is still missing / not approved for */
  missingTemplates: string[];
  lastError: string | null;
  /** Embedded Signup is configured on this deployment (NEXT_PUBLIC_META_APP_ID + NEXT_PUBLIC_META_ES_CONFIG_ID + META_APP_SECRET) */
  signupAvailable: boolean;
}

export interface ConnectInput {
  businessId: string;
  userId: string;
  /** Authorization code from FB.login (response_type "code") — exchanged server-side for a business-integration token */
  code: string;
  phoneNumberId: string;
  wabaId: string;
  coexistence?: boolean;
}

/** True when all env needed for Embedded Signup is present. */
export function isWhatsAppEmbeddedSignupConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_META_APP_ID && process.env.NEXT_PUBLIC_META_ES_CONFIG_ID && process.env.META_APP_SECRET);
}

/** Which phone/token to send from for this business (business number if active + template approved there, else platform). Null when nothing is configured at all (stub mode). */
export async function resolveWhatsAppSender(
  _businessId?: string | null,
  _opts?: { templateName?: string }
): Promise<WaSender | null> {
  throw new Error("not implemented");
}

export async function getWhatsAppConnectionStatus(_businessId: string): Promise<WaConnectionStatus> {
  throw new Error("not implemented");
}

/** Exchange code → token, subscribe app to WABA, register/verify phone, store encrypted token, kick off template sync. */
export async function connectWhatsAppBusiness(_input: ConnectInput): Promise<WaConnectionStatus> {
  throw new Error("not implemented");
}

/** Copy the platform's approved templates onto the business WABA (idempotent) and refresh templatesJson. */
export async function syncWhatsAppTemplates(_businessId: string): Promise<WaConnectionStatus> {
  throw new Error("not implemented");
}

/** Mark disconnected, drop the token (overwrite with ""), best-effort unsubscribe app from WABA. */
export async function disconnectWhatsAppBusiness(_businessId: string, _userId: string): Promise<void> {
  throw new Error("not implemented");
}

/** Webhook routing: phone_number_id → businessId (null for the platform number / unknown). */
export async function findBusinessIdByPhoneNumberId(_phoneNumberId: string): Promise<string | null> {
  throw new Error("not implemented");
}
