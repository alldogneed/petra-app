/**
 * Rate limiter + one-shot claims — Postgres (table RateLimitBucket, atomic across all
 * serverless instances), in-memory fallback when the DB is unreachable / in dev.
 * No Redis: the Upstash database behind this file was deleted (prod logged ENOTFOUND on
 * every call, 10/2026) and the Postgres path already carried the limiter.
 *
 * Sync usage (legacy, in-memory only — use for low-sensitivity endpoints):
 *   const result = rateLimit("api:x", ip, { max: 120, windowMs: 60_000 });
 *   if (!result.allowed) return 429;
 *
 * Async usage (distributed, use for auth + public endpoints):
 *   const result = await rateLimitAsync("auth:login", ip, { max: 10, windowMs: 600_000 });
 *   if (!result.allowed) return 429;
 */
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
  /** Support tickets + replies: each one alerts the platform owner by WhatsApp — keep it low */
  SUPPORT_WRITE: { max: 6, windowMs: 60 * 1000 },
  /** Authenticated write operations: 120 per minute per IP (generous for normal use) */
  API_WRITE: { max: 120, windowMs: 60 * 1000 },
  /** Lead webhook: 60 per minute per IP */
  WEBHOOK_LEAD: { max: 60, windowMs: 60 * 1000 },
  /** Public read endpoints (general): 30 per minute per IP */
  PUBLIC_READ: { max: 30, windowMs: 60 * 1000 },
  /** Sensitive token endpoints (intake, QR): 10 per minute per IP — prevents brute-force enumeration */
  STRICT_TOKEN: { max: 10, windowMs: 60 * 1000 },
  /** Petra AI questions, per business: short burst window + daily cap (paid plans) */
  ASSISTANT_BURST: { max: 20, windowMs: 10 * 60 * 1000 },
  ASSISTANT_DAILY: { max: 200, windowMs: 24 * 60 * 60 * 1000 },
  /** Petra AI questions, per business on the free plan */
  ASSISTANT_BURST_FREE: { max: 10, windowMs: 10 * 60 * 1000 },
  ASSISTANT_DAILY_FREE: { max: 40, windowMs: 24 * 60 * 60 * 1000 },
  /** Petra AI "דבר עם אדם" escalations: 5 per hour per business */
  ASSISTANT_ESCALATE: { max: 5, windowMs: 60 * 60 * 1000 },
} as const;

// ─── Postgres limiter ────────────────────────────────────────────────────────

let _lastPrune = 0;
const DB_LIMITER_TIMEOUT_MS = 1500;
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
  // Cheap short-circuit: if this instance already knows the key is over the limit in the
  // current window, answer 429 without touching the DB (keeps bursts off the pooler).
  const local = getStore().get(`${namespace}:${key}`);
  if (local && local.resetAt > now && local.count > options.max) {
    return { allowed: false, remaining: 0, resetAt: local.resetAt, retryAfterMs: Math.max(0, local.resetAt - now) };
  }
  try {
    // A limiter must never stall a request: bound the DB round-trip, fail open to memory.
    const query = prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "RateLimitBucket" ("key", "count", "windowEnd")
      VALUES (${bucketKey}, 1, ${windowEnd})
      ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
      RETURNING "count"`;
    const rows = await Promise.race([
      query,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), DB_LIMITER_TIMEOUT_MS)),
    ]);
    if (!rows) {
      console.warn(`DB rate limit timeout (${DB_LIMITER_TIMEOUT_MS}ms) for ${namespace} — falling back to memory`);
      return null;
    }
    const count = Number(rows[0]?.count ?? 1);
    // Mirror into the local store so the short-circuit above works on this instance.
    getStore().set(`${namespace}:${key}`, { count, resetAt: windowEnd.getTime() });
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
 * Distributed rate limit check — Postgres fixed window (atomic across instances),
 * in-memory when the DB is unreachable or slow. Use for all auth and public endpoints.
 */
export async function rateLimitAsync(
  namespace: string,
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const dbResult = await rateLimitDb(namespace, key, options);
  if (dbResult) return dbResult;
  // Fallback: in-memory (last resort, per instance)
  return rateLimit(namespace, key, options);
}

// ─── One-shot claim (throttle / dedupe) ──────────────────────────────────────
const _claimMemory = new Map<string, number>(); // key → expiry epoch ms

/**
 * Atomically "claim" a key for `ttlSeconds`. Returns true for the FIRST caller
 * within the window, false for subsequent ones — use it to throttle repeated
 * side effects (e.g. send an alert at most once per N hours) across serverless
 * instances. Postgres (RateLimitBucket row `claim:<key>`); per-instance memory only
 * when the DB is unreachable.
 */
export async function claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
  const db = await claimDb(key, ttlSeconds);
  if (db !== null) return db;
  // Fallback: per-instance memory
  const now = Date.now();
  const exp = _claimMemory.get(key);
  if (exp && exp > now) return false;
  _claimMemory.set(key, now + ttlSeconds * 1000);
  return true;
}

/**
 * Give a claim back (the work it guarded failed and should be retried by the next caller).
 * Never throws.
 */
export async function releaseClaim(key: string): Promise<void> {
  _claimMemory.delete(key);
  try {
    await prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "key" = ${`claim:${key}`}`;
  } catch (err) {
    console.error("releaseClaim DB error:", err);
  }
}

/**
 * One round-trip, atomic: insert the claim row, or take over an EXPIRED one; a live
 * row makes the conditional update a no-op → no row returned → not claimed.
 * Expired claim rows are removed by the limiter's prune (windowEnd in the past).
 * Null on DB error / timeout (caller falls back to memory).
 */
async function claimDb(key: string, ttlSeconds: number): Promise<boolean | null> {
  const bucketKey = `claim:${key}`;
  const until = new Date(Date.now() + ttlSeconds * 1000);
  try {
    const query = prisma.$queryRaw<Array<{ key: string }>>`
      INSERT INTO "RateLimitBucket" ("key", "count", "windowEnd")
      VALUES (${bucketKey}, 1, ${until})
      ON CONFLICT ("key") DO UPDATE SET "count" = 1, "windowEnd" = EXCLUDED."windowEnd"
      WHERE "RateLimitBucket"."windowEnd" < NOW()
      RETURNING "key"`;
    const rows = await Promise.race([
      query,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), DB_LIMITER_TIMEOUT_MS)),
    ]);
    if (!rows) {
      console.warn(`claimOnce DB timeout (${DB_LIMITER_TIMEOUT_MS}ms) for ${key} — falling back to memory`);
      return null;
    }
    return rows.length > 0;
  } catch (err) {
    console.error("claimOnce DB error, falling back to memory:", err);
    return null;
  }
}

/** A claim made by claimOnce(key) is still live (read only, never claims). False on DB error. */
export async function hasActiveClaim(key: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ key: string }>>`
      SELECT "key" FROM "RateLimitBucket" WHERE "key" = ${`claim:${key}`} AND "windowEnd" > NOW() LIMIT 1`;
    return rows.length > 0;
  } catch {
    return _claimMemory.has(key) && (_claimMemory.get(key) ?? 0) > Date.now();
  }
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
