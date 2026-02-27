/**
 * In-memory rate limiter (MVP).
 * Replace with Upstash Redis in production for distributed deployments.
 *
 * Usage:
 *   const result = await rateLimit("auth", ip, { max: 10, windowMs: 10 * 60 * 1000 });
 *   if (!result.allowed) return 429 response;
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Global in-memory store (survives hot reloads in dev via globalThis)
const globalStore = globalThis as typeof globalThis & {
  _rateLimitStore?: Map<string, RateLimitEntry>;
};

function getStore(): Map<string, RateLimitEntry> {
  if (!globalStore._rateLimitStore) {
    globalStore._rateLimitStore = new Map();
  }
  return globalStore._rateLimitStore;
}

interface RateLimitOptions {
  /** Max requests allowed in the window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
}

/**
 * Check and increment rate limit counter.
 * @param namespace - e.g. "auth:login"
 * @param key - e.g. ip address or "ip:email"
 */
export function rateLimit(
  namespace: string,
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const store = getStore();
  const storeKey = `${namespace}:${key}`;
  const now = Date.now();

  let entry = store.get(storeKey);

  // Reset if window expired
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + options.windowMs };
  }

  entry.count++;
  store.set(storeKey, entry);

  const allowed = entry.count <= options.max;
  const remaining = Math.max(0, options.max - entry.count);
  const retryAfterMs = allowed ? 0 : entry.resetAt - now;

  return { allowed, remaining, resetAt: entry.resetAt, retryAfterMs };
}

/** Rate limit presets */
export const RATE_LIMITS = {
  /** Auth login: 10 attempts per 10 minutes */
  AUTH_LOGIN: { max: 10, windowMs: 10 * 60 * 1000 },
  /** 2FA verify: 5 attempts per 5 minutes */
  TOTP_VERIFY: { max: 5, windowMs: 5 * 60 * 1000 },
  /** Owner panel actions: 100 per minute */
  OWNER_API: { max: 100, windowMs: 60 * 1000 },
  /** OAuth callback: 20 per 10 minutes */
  OAUTH_CALLBACK: { max: 20, windowMs: 10 * 60 * 1000 },
  /** Invoice webhook: 100 per minute per IP */
  INVOICE_WEBHOOK: { max: 100, windowMs: 60 * 1000 },
  /** Invoice API: 60 per minute per user */
  INVOICE_API: { max: 60, windowMs: 60 * 1000 },
  /** Authenticated write operations: 120 per minute per IP (generous for normal use) */
  API_WRITE: { max: 120, windowMs: 60 * 1000 },
  /** Lead webhook: 60 per minute per IP */
  WEBHOOK_LEAD: { max: 60, windowMs: 60 * 1000 },
  /** Public read endpoints (intake, QR): 30 per minute per IP */
  PUBLIC_READ: { max: 30, windowMs: 60 * 1000 },
} as const;

/** Periodic cleanup of expired entries (call from a cron or app init) */
export function cleanupRateLimitStore(): number {
  const store = getStore();
  const now = Date.now();
  let removed = 0;
  store.forEach((entry, key) => {
    if (entry.resetAt <= now) {
      store.delete(key);
      removed++;
    }
  });
  return removed;
}
