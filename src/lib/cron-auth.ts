import crypto from "crypto";
import { NextRequest } from "next/server";

/**
 * Verify cron job request authenticity.
 * Accepts BOTH:
 *   - Authorization: Bearer <CRON_SECRET>  ← Vercel built-in cron format
 *   - x-cron-secret: <CRON_SECRET>         ← external callers / legacy
 */
export function verifyCronAuth(request: NextRequest): boolean {
  // CRON_SECRET = Vercel / GitHub Actions. CRON_SECRET_DB = Supabase pg_cron only
  // (prisma/cron_send_reminders.sql, read from Vault) — rotatable on its own.
  const secrets = [process.env.CRON_SECRET, process.env.CRON_SECRET_DB].filter(
    (s): s is string => typeof s === "string" && s.length > 0
  );
  if (secrets.length === 0) return false;

  const check = (token: string): boolean =>
    secrets.some((secret) => {
      try {
        const a = Buffer.from(token);
        const b = Buffer.from(secret);
        return a.length === b.length && crypto.timingSafeEqual(a, b);
      } catch {
        return false;
      }
    });

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
