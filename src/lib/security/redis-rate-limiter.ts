/**
 * Rate limiter for the Cardcom payment routes.
 *
 * Thin wrapper over `rateLimitAsync()` (src/lib/rate-limit.ts) so payments get the
 * same chain as every other limiter: Upstash Redis → (on failure: 60s circuit breaker)
 * Postgres fixed-window counter (atomic across serverless instances) → in-memory.
 * It used to have its own Redis client with no breaker and only a per-instance memory
 * fallback — with Redis unreachable, every payment call paid a failed lookup and the
 * limit was not enforced across instances.
 *
 * Usage:
 *   const rl = await rateLimitRedis("cardcom:create", ip, { max: 5, windowSec: 900 });
 *   if (!rl.allowed) return 429;
 */
import { rateLimitAsync } from "@/lib/rate-limit";

interface RateLimitOpts {
  /** Max requests in window */
  max: number;
  /** Window in seconds */
  windowSec: number;
}

interface RateLimitResult {
  allowed: boolean;
}

/** Distributed rate limit check (Redis → Postgres → memory). */
export async function rateLimitRedis(
  namespace: string,
  key: string,
  opts: RateLimitOpts
): Promise<RateLimitResult> {
  const result = await rateLimitAsync(namespace, key, { max: opts.max, windowMs: opts.windowSec * 1000 });
  return { allowed: result.allowed };
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
