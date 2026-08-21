/**
 * Rate limiter — Upstash Redis in production, in-memory fallback in dev.
 *
 * Sync usage (legacy, in-memory only — use for low-sensitivity endpoints):
 *   const result = rateLimit("api:x", ip, { max: 120, windowMs: 60_000 });
 *   if (!result.allowed) return 429;
 *
 * Async usage (distributed, use for auth + public endpoints):
 *   const result = await rateLimitAsync("auth:login", ip, { max: 10, windowMs: 600_000 });
 *   if (!result.allowed) return 429;
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import prisma from "@/lib/prisma";

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
  /** Public read endpoints (general): 30 per minute per IP */
  PUBLIC_READ: { max: 30, windowMs: 60 * 1000 },
  /** Sensitive token endpoints (intake, QR): 10 per minute per IP — prevents brute-force enumeration */
  STRICT_TOKEN: { max: 10, windowMs: 60 * 1000 },
} as const;

// ─── Distributed rate limiter (Upstash Redis) ────────────────────────────────

let _redis: Redis | null = null;
// Circuit breaker: after a Redis failure, skip Redis for a while instead of
// paying a retry/backoff delay on every request (a broken URL made every
// limiter call wait seconds in prod, 2026-08-21).
let _redisDisabledUntil = 0;
const REDIS_BREAKER_MS = 60_000;
function _getRedis(): Redis | null {
  if (Date.now() < _redisDisabledUntil) return null;
  if (_redis) return _redis;
  // Strip ALL whitespace: a newline/space pasted into the Vercel env var makes
  // the Upstash client throw "invalid URL" (or reach a wrong host) on every call.
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\s+/g, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.replace(/\s+/g, "");
  if (!url || !token) return null;
  _redis = new Redis({ url, token, retry: { retries: 1, backoff: () => 100 } });
  return _redis;
}
function _tripRedisBreaker(): void {
  _redisDisabledUntil = Date.now() + REDIS_BREAKER_MS;
  _redis = null;
  _limiters.clear();
}

const _limiters = new Map<string, Ratelimit>();
function _getLimiter(namespace: string, max: number, windowSec: number): Ratelimit | null {
  const r = _getRedis();
  if (!r) return null;
  const key = `${namespace}:${max}:${windowSec}`;
  if (!_limiters.has(key)) {
    _limiters.set(key, new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
      prefix: `rl:${namespace}`,
    }));
  }
  return _limiters.get(key)!;
}

// ─── Postgres fallback limiter ───────────────────────────────────────────────

let _lastPrune = 0;
/**
 * Fixed-window counter in the RateLimitBucket table. One round-trip per call
 * (INSERT … ON CONFLICT DO UPDATE … RETURNING) — atomic, so it is correct across
 * all serverless instances. Returns null on DB error so the caller can degrade to
 * memory instead of failing the request.
 */
async function rateLimitDb(
  namespace: string,
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult | null> {
  const now = Date.now();
  const windowStart = Math.floor(now / options.windowMs) * options.windowMs;
  const windowEnd = new Date(windowStart + options.windowMs);
  const bucketKey = `${namespace}:${key}:${windowStart}`;
  try {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "RateLimitBucket" ("key", "count", "windowEnd")
      VALUES (${bucketKey}, 1, ${windowEnd})
      ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
      RETURNING "count"`;
    const count = Number(rows[0]?.count ?? 1);
    // Opportunistic prune of expired windows (at most once a minute per instance).
    if (now - _lastPrune > 60_000) {
      _lastPrune = now;
      prisma.rateLimitBucket.deleteMany({ where: { windowEnd: { lt: new Date(now - 60_000) } } }).catch(() => {});
    }
    const allowed = count <= options.max;
    return {
      allowed,
      remaining: Math.max(0, options.max - count),
      resetAt: windowEnd.getTime(),
      retryAfterMs: allowed ? 0 : Math.max(0, windowEnd.getTime() - now),
    };
  } catch (err) {
    console.error("DB rate limit error, falling back to memory:", err);
    return null;
  }
}

/**
 * Distributed rate limit check — uses Upstash Redis when configured,
 * falls back to in-memory for local dev.
 * Use this for all auth and public-facing endpoints.
 */
export async function rateLimitAsync(
  namespace: string,
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const windowSec = Math.ceil(options.windowMs / 1000);
  try {
    const limiter = _getLimiter(namespace, options.max, windowSec);
    if (limiter) {
      const result = await limiter.limit(key);
      const now = Date.now();
      const retryAfterMs = result.success ? 0 : result.reset - now;
      return {
        allowed: result.success,
        remaining: result.remaining,
        resetAt: result.reset,
        retryAfterMs: Math.max(0, retryAfterMs),
      };
    }
  } catch (err) {
    console.error("Redis rate limit error, falling back to memory:", err);
    _tripRedisBreaker();
  }
  // Fallback 1: Postgres fixed-window counter — atomic across all serverless instances
  // (Redis was unreachable in prod for weeks; per-instance memory let parallel bursts through).
  const dbResult = await rateLimitDb(namespace, key, options);
  if (dbResult) return dbResult;
  // Fallback 2: in-memory (last resort, per instance)
  return rateLimit(namespace, key, options);
}

// ─── One-shot claim (throttle / dedupe) ──────────────────────────────────────
const _claimMemory = new Map<string, number>(); // key → expiry epoch ms

/**
 * Atomically "claim" a key for `ttlSeconds`. Returns true for the FIRST caller
 * within the window, false for subsequent ones — use it to throttle repeated
 * side effects (e.g. send an alert at most once per N hours) across serverless
 * instances. Uses Upstash Redis (SET NX EX); falls back to per-instance memory.
 */
export async function claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
  try {
    const r = _getRedis();
    if (r) {
      const res = await r.set(`claim:${key}`, "1", { nx: true, ex: ttlSeconds });
      return res === "OK";
    }
  } catch (err) {
    console.error("claimOnce Redis error, falling back to memory:", err);
    _tripRedisBreaker();
  }
  // Fallback: per-instance memory
  const now = Date.now();
  const exp = _claimMemory.get(key);
  if (exp && exp > now) return false;
  _claimMemory.set(key, now + ttlSeconds * 1000);
  return true;
}

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
