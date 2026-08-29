// Shared helpers for the portal API routes (/api/portal/[slug]/*).
// Not a route file — App Router ignores non-route files colocated in app/.
import { NextRequest, NextResponse } from "next/server";
import { rateLimitAsync } from "@/lib/rate-limit";
import { ServiceError } from "@/services/types";

interface RateLimitOptions {
  max: number;
  windowMs: number;
}

/** Client IP for rate limiting (same pattern as /api/auth/forgot-password). */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}

/**
 * Rate-limit key for an authenticated portal write. Keying on IP alone punishes
 * a whole school behind one NAT and caps nothing per account; combining the
 * membership with the IP bounds both.
 */
export function portalRateKey(
  request: NextRequest,
  membershipId: string | null | undefined
): string {
  const ip = getClientIp(request);
  return membershipId ? `${membershipId}:${ip}` : ip;
}

/**
 * Distributed rate limit check. Returns a ready 429 NextResponse (Hebrew,
 * with Retry-After header) when the limit is exceeded, or null when allowed.
 */
export async function enforcePortalRateLimit(
  namespace: string,
  key: string,
  options: RateLimitOptions
): Promise<NextResponse | null> {
  const rl = await rateLimitAsync(namespace, key, options);
  if (rl.allowed) return null;
  const retryAfterSec = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
  return NextResponse.json(
    { error: "יותר מדי בקשות. נסה שוב בעוד מספר דקות." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

const SERVICE_ERROR_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  UNAUTHORIZED: 403,
};

const SERVICE_ERROR_FALLBACK_MESSAGE: Record<string, string> = {
  NOT_FOUND: "לא נמצא",
  VALIDATION: "בקשה לא תקינה",
  CONFLICT: "התנגשות בנתונים — נסה שוב",
  UNAUTHORIZED: "אין הרשאה לבצע פעולה זו",
};

/** Map a caught error to an HTTP response with a Hebrew message. */
export function portalErrorResponse(
  error: unknown,
  logContext: string
): NextResponse {
  if (error instanceof ServiceError) {
    const status = SERVICE_ERROR_STATUS[error.code] ?? 500;
    const message =
      error.message || SERVICE_ERROR_FALLBACK_MESSAGE[error.code] || "שגיאת שרת";
    return NextResponse.json({ error: message }, { status });
  }
  console.error(`${logContext} error:`, error);
  return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
}
