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

/**
 * Secret of the Supabase pg_cron caller (prisma/cron_send_reminders.sql), read from
 * Supabase Vault — the same value the job sends — so no deploy env change is needed.
 * Cached for 5 minutes; a missing Vault / secret just means "no extra secret".
 */
let vaultSecretCache: { value: string | null; at: number } | null = null;
const VAULT_CACHE_MS = 5 * 60 * 1000;

async function pgCronVaultSecret(): Promise<string | null> {
  if (vaultSecretCache && Date.now() - vaultSecretCache.at < VAULT_CACHE_MS) return vaultSecretCache.value;
  let value: string | null = null;
  try {
    const { default: prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRaw<{ decrypted_secret: string | null }[]>`
      select decrypted_secret from vault.decrypted_secrets where name = 'petra_cron_secret' limit 1`;
    value = rows[0]?.decrypted_secret || null;
  } catch {
    value = null; // local Postgres without Vault, or no access
  }
  vaultSecretCache = { value, at: Date.now() };
  return value;
}

/** verifyCronAuth + the pg_cron secret from Vault (for endpoints that pg_cron calls). */
export async function verifyCronAuthWithVault(request: NextRequest): Promise<boolean> {
  if (verifyCronAuth(request)) return true;
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : request.headers.get("x-cron-secret");
  if (!token) return false;
  const secret = await pgCronVaultSecret();
  if (!secret) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
