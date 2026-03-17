/**
 * In-memory sliding-window rate limiter.
 * Simple per-IP counter using a Map of timestamps.
 * For production at scale, replace with Redis.
 */

const requests = new Map<string, number[]>();

/** Returns true if the request is within limits, false if it should be blocked. */
export function checkRateLimit(ip: string, maxPerMinute = 10): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const times = (requests.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (times.length >= maxPerMinute) return false;
  requests.set(ip, [...times, now]);
  return true;
}
