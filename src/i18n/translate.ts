/**
 * translate — synchronous message lookup by locale, for code that has no React
 * context: src/lib label helpers, services, API routes, e-mails, MCP output.
 * Client-safe (the two JSON catalogs are already bundled by verticals/vocab.ts).
 *
 *   const t = translatorFor(locale, "api.customers");  t("notFound")
 *   translate(locale, "common.actions.save")
 *
 * Rules (docs/i18n.md → "Server side"):
 *   - he-IL output must stay byte-identical to the Hebrew the code returned before
 *     (he.json = verbatim source; checked by i18n-verify-he).
 *   - en-US: a key missing in en.json falls back to Hebrew (same as the UI).
 *   - Missing locale / unknown locale → he-IL, so every existing caller is unchanged.
 */
import { createTranslator } from "next-intl";
import he from "../../messages/he.json";
import en from "../../messages/en.json";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/locale";

type Messages = { [key: string]: string | Messages };
export type TranslateValues = Record<string, string | number | Date | null | undefined>;
/** A plain string translator (keys are checked by `npm run check:i18n`, not by TS). */
export type Translate = (key: string, values?: TranslateValues) => string;

function deepMerge(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = typeof v === "object" && typeof b === "object" ? deepMerge(b, v) : v;
  }
  return out;
}

let enMerged: Messages | null = null;
function messagesFor(locale: Locale): Messages {
  if (locale === DEFAULT_LOCALE) return he as unknown as Messages;
  enMerged ??= deepMerge(he as unknown as Messages, en as unknown as Messages);
  return enMerged;
}

/** Normalise anything (null, "en", "en-US", "fr") to a supported locale. */
export function normalizeLocale(locale: string | null | undefined): Locale {
  if (isLocale(locale)) return locale;
  const lang = (locale ?? "").toLowerCase().split(/[-_]/)[0];
  if (lang === "en") return "en-US";
  return DEFAULT_LOCALE;
}

const cache = new Map<string, Translate>();

export function translatorFor(locale?: string | null, namespace?: string): Translate {
  const loc = normalizeLocale(locale);
  const cacheKey = `${loc}|${namespace ?? ""}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const t = createTranslator({
    locale: loc,
    messages: messagesFor(loc),
    namespace: namespace as never,
    // A missing key must never crash a request: return the key path (check:i18n catches it in CI).
    onError: () => undefined,
    getMessageFallback: ({ key, namespace: ns }) => (ns ? `${ns}.${key}` : key),
  }) as unknown as (key: string, values?: Record<string, unknown>) => string;
  const fn: Translate = (key, values) => t(key, values as Record<string, unknown>);
  cache.set(cacheKey, fn);
  return fn;
}

export function translate(locale: string | null | undefined, key: string, values?: TranslateValues): string {
  return translatorFor(locale)(key, values);
}

/** Does the key exist (in he.json — the source of truth)? */
export function hasMessage(key: string): boolean {
  let node: unknown = he;
  for (const part of key.split(".")) {
    if (!node || typeof node !== "object") return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string";
}
