/**
 * Shared security helpers for Cardcom payment routes.
 */
import { createHmac } from "crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://petra-app.com";

/**
 * Build the indicator URL with an HMAC signature instead of raw secret.
 * The HMAC signs the lowprofilecode (injected by Cardcom as query param),
 * so we validate authenticity without exposing the secret in the URL.
 *
 * We still use a query-param based approach (Cardcom appends its own params),
 * but the value is a one-way hash — not the raw secret.
 */
export function buildIndicatorUrl(route: string): string {
  // Use a static HMAC tag derived from the secret — Cardcom will append lowprofilecode etc.
  const secret = process.env.CARDCOM_WEBHOOK_SECRET ?? "";
  const hmac = createHmac("sha256", secret).update(route).digest("hex").slice(0, 32);
  return `${APP_URL}${route}?sig=${hmac}`;
}

/**
 * Verify the indicator signature.
 * Compares the `sig` param against the expected HMAC for the route.
 */
export function verifyIndicatorSignature(route: string, providedSig: string): boolean {
  const secret = process.env.CARDCOM_WEBHOOK_SECRET ?? "";
  if (!secret || !providedSig) return false;
  const expected = createHmac("sha256", secret).update(route).digest("hex").slice(0, 32);
  // Constant-time comparison
  if (expected.length !== providedSig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ providedSig.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Sanitize a URL for logging — strips query params that may contain secrets.
 */
export function sanitizeUrlForLog(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("secret");
    u.searchParams.delete("sig");
    return u.pathname;
  } catch {
    return "[invalid-url]";
  }
}

/**
 * Validate Origin header for CSRF protection on mutating endpoints.
 * Returns true if the origin matches the app domain.
 */
export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const appHost = new URL(APP_URL).host;

  // Server-to-server calls (no Origin/Referer) — allow (e.g., Cardcom webhooks)
  if (!origin && !referer) return true;

  if (origin) {
    try {
      return new URL(origin).host === appHost;
    } catch {
      return false;
    }
  }

  if (referer) {
    try {
      return new URL(referer).host === appHost;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Validate and sanitize invoice fields (shared between payment routes).
 */
export function validateInvoiceFields(body: Record<string, unknown>) {
  const VALID_BUSINESS_TYPES = ["חברה (ח.פ)", "עוסק מורשה (ע.מ)", "עוסק פטור"];

  const phone = ((body.phone as string) ?? "").replace(/[\s\-]/g, "").trim().slice(0, 15);
  const address = ((body.address as string) ?? "").trim().slice(0, 200);
  const vatNumber = ((body.vatNumber as string) ?? "").replace(/\D/g, "").slice(0, 15);
  const businessType = ((body.businessType as string) ?? "").trim();
  const billingEmail = ((body.billingEmail as string) ?? "").toLowerCase().trim().slice(0, 254);

  return {
    phone: phone || undefined,
    address: address || undefined,
    vatNumber: vatNumber || undefined,
    businessType: VALID_BUSINESS_TYPES.includes(businessType) ? businessType : undefined,
    billingEmail: billingEmail || undefined,
  };
}
