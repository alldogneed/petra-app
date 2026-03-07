import crypto from "crypto";
import { NextRequest } from "next/server";

/**
 * Verify cron job request authenticity.
 * Accepts BOTH:
 *   - Authorization: Bearer <CRON_SECRET>  ← Vercel built-in cron format
 *   - x-cron-secret: <CRON_SECRET>         ← external callers / legacy
 */
export function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const check = (token: string): boolean => {
    try {
      const a = Buffer.from(token);
      const b = Buffer.from(cronSecret);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  };

  // Authorization: Bearer <secret>  (Vercel Cron)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return check(authHeader.slice(7));
  }

  // x-cron-secret header  (external / manual calls)
  const xSecret = request.headers.get("x-cron-secret");
  if (xSecret) return check(xSecret);

  return false;
}
