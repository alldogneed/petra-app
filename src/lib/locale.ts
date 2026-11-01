/**
 * Locale — single source of truth for the languages Petra supports.
 * The dashboard locale comes from the BUSINESS (`Business.locale`), never
 * from the browser. See docs/us-expansion-plan.md §3.2 and docs/i18n.md.
 *
 * Client-safe: no server imports here.
 */

export const LOCALES = ["he-IL", "en-US"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "he-IL";

export interface LocaleConfig {
  /** `<html lang>` value + next-intl message file (`messages/<lang>.json`) */
  lang: "he" | "en";
  dir: "rtl" | "ltr";
  /** Default currency for a NEW business in this locale (existing ones keep `Business.currency`) */
  currency: "ILS" | "USD";
  /** Default country for a NEW business in this locale */
  country: "IL" | "US";
  /** Key of the matching date-fns locale (see `dateFnsLocaleFor` in src/lib/format.ts) */
  dateFnsLocale: "he" | "enUS";
  hourCycle: "h23" | "h12";
  /** Default IANA time zone for a NEW business (US businesses pick theirs at sign-up) */
  timezone: string;
}

export const LOCALE_CONFIG: Record<Locale, LocaleConfig> = {
  "he-IL": {
    lang: "he",
    dir: "rtl",
    currency: "ILS",
    country: "IL",
    dateFnsLocale: "he",
    hourCycle: "h23",
    timezone: "Asia/Jerusalem",
  },
  "en-US": {
    lang: "en",
    dir: "ltr",
    currency: "USD",
    country: "US",
    dateFnsLocale: "enUS",
    hourCycle: "h12",
    timezone: "America/New_York",
  },
};

export function isLocale(x: unknown): x is Locale {
  return typeof x === "string" && (LOCALES as readonly string[]).includes(x);
}

/** The business's locale, falling back to he-IL for missing/unknown values. */
export function localeFromBusiness(b: { locale?: string | null } | null | undefined): Locale {
  const raw = b?.locale;
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

/** Cookie used ONLY for public/marketing pages without a business context. */
export const LOCALE_COOKIE = "NEXT_LOCALE";
