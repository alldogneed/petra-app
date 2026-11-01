/**
 * Server-side locale for API routes, services, crons and MCP (US plan, Phase 2).
 *
 *   const t = await getServerT("api.customers");      // inside a route handler / service
 *   return NextResponse.json({ error: t("notFound") }, { status: 404 });
 *
 *   await withLocale(business.locale, () => sendDigest(business));   // cron / MCP / jobs
 *
 * Resolution order: withLocale() scope → signed-in session's business (same rule as
 * page rendering, resolve-locale.ts) → he-IL. Outside a request (jest, scripts) the
 * cookie lookup throws and we fall back to he-IL, so Hebrew output never changes.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";
import { normalizeLocale, translatorFor, type Translate } from "./translate";

const scope = new AsyncLocalStorage<Locale>();

/** Run `fn` with a fixed locale (e.g. the business of a cron row / MCP token). */
export function withLocale<T>(locale: string | null | undefined, fn: () => T): T {
  return scope.run(normalizeLocale(locale), fn);
}

export async function getServerLocale(): Promise<Locale> {
  const scoped = scope.getStore();
  if (scoped) return scoped;
  try {
    const { resolveRequestLocale } = await import("./resolve-locale");
    return (await resolveRequestLocale()).locale;
  } catch {
    return DEFAULT_LOCALE; // no request scope (cron without withLocale, tests, scripts)
  }
}

export async function getServerT(namespace?: string): Promise<Translate> {
  return translatorFor(await getServerLocale(), namespace);
}

/** Locale of a business by id (60s cache) — for crons, e-mails and jobs that know the business. */
export async function localeOfBusiness(businessId: string | null | undefined): Promise<Locale> {
  if (!businessId) return DEFAULT_LOCALE;
  try {
    const { businessRequestLocale } = await import("./resolve-locale");
    return (await businessRequestLocale(businessId))?.locale ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
