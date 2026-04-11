/**
 * Distributed rate limiter using Upstash Redis.
 * Falls back to in-memory if UPSTASH_REDIS_REST_URL is not configured.
 *
 * Usage:
 *   const rl = await rateLimitRedis("cardcom:create", ip, { max: 5, windowSec: 900 });
 *   if (!rl.allowed) return 429;
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ── Redis client (singleton) ──────────────────────────────────────────────────

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// ── In-memory fallback (same as before, for local dev) ────────────────────────

const memStore = new Map<string, { count: number; resetAt: number }>();

function memoryRateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  let entry = memStore.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
  }
  entry.count++;
  memStore.set(key, entry);
  return { allowed: entry.count <= max };
}

// ── Cache of Upstash Ratelimit instances per namespace ────────────────────────

const limiters = new Map<string, Ratelimit>();

function getLimiter(namespace: string, max: number, windowSec: number): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;

  const key = `${namespace}:${max}:${windowSec}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
      prefix: `rl:${namespace}`,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

// ── Public API ────────────────────────────────────────────────────────────────

interface RateLimitOpts {
  /** Max requests in window */
  max: number;
  /** Window in seconds */
  windowSec: number;
}

interface RateLimitResult {
  allowed: boolean;
}

/**
 * Distributed rate limit check.
 * Uses Upstash Redis when available, falls back to in-memory.
 */
export async function rateLimitRedis(
  namespace: string,
  key: string,
  opts: RateLimitOpts
): Promise<RateLimitResult> {
  try {
    const limiter = getLimiter(namespace, opts.max, opts.windowSec);

    if (!limiter) {
      // Fallback to in-memory (dev or no Redis configured)
      return memoryRateLimit(`${namespace}:${key}`, opts.max, opts.windowSec * 1000);
    }

    const result = await limiter.limit(key);
    return { allowed: result.success };
  } catch (err) {
    console.error("Redis rate limit error, falling back to memory:", err);
    return memoryRateLimit(`${namespace}:${key}`, opts.max, opts.windowSec * 1000);
  }
}

/** Presets for common rate limit scenarios */
export const RL = {
  /** Public checkout/trial creation: 5 per 15 min */
  CARDCOM_PUBLIC: { max: 5, windowSec: 900 },
  /** Authenticated payment creation: 5 per 15 min */
  CARDCOM_AUTH: { max: 5, windowSec: 900 },
  /** Webhook indicators: 20 per minute */
  CARDCOM_WEBHOOK: { max: 20, windowSec: 60 },
} as const;
