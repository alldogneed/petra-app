/**
 * Server-side locale resolution for rendering (docs/us-expansion-plan.md §3.2).
 *
 *   1. Signed-in session with a business → that business's `locale` (+ timezone).
 *   2. Otherwise (public / marketing pages) → `NEXT_LOCALE` cookie, else he-IL.
 *
 * The business always wins: a cookie / header can never switch the language of
 * an authenticated dashboard. API routes must NOT use this — they read the
 * business from the session they already resolved (Phase 2).
 */
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSessionByToken, SESSION_COOKIE } from "@/lib/session";
import {
  DEFAULT_LOCALE,
  LOCALE_CONFIG,
  LOCALE_COOKIE,
  isLocale,
  localeFromBusiness,
  type Locale,
} from "@/lib/locale";

export interface RequestLocale {
  locale: Locale;
  timeZone: string;
}

// Business locale changes rarely — cache per instance for 60s (same order as the session cache).
const CACHE_TTL_MS = 60_000;
const businessCache = new Map<string, { value: RequestLocale; expiresAt: number }>();

async function businessLocale(businessId: string): Promise<RequestLocale | null> {
  const hit = businessCache.get(businessId);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { locale: true, timezone: true },
  });
  if (!b) return null;
  const locale = localeFromBusiness(b);
  const value: RequestLocale = {
    locale,
    timeZone: b.timezone || LOCALE_CONFIG[locale].timezone,
  };
  if (businessCache.size > 5000) businessCache.clear();
  businessCache.set(businessId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/** Drop the cached locale of a business (call after changing Business.locale/timezone). */
export function invalidateBusinessLocaleCache(businessId: string): void {
  businessCache.delete(businessId);
}

export async function resolveRequestLocale(): Promise<RequestLocale> {
  const store = cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const session = await getSessionByToken(token);
      const businessId =
        session?.impersonatedBusinessId ?? session?.memberships[0]?.businessId ?? null;
      if (businessId) {
        const fromBusiness = await businessLocale(businessId);
        if (fromBusiness) return fromBusiness;
      }
    } catch {
      // DB hiccup → fall through to the default; never break rendering over the language.
    }
  }
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  return { locale, timeZone: LOCALE_CONFIG[locale].timezone };
}
