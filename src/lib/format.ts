/**
 * Locale-aware formatting — replaces the he-IL/ILS-only helpers in utils.ts.
 * Always pass the BUSINESS locale/currency/timezone (client: `useBusinessLocale()`,
 * server: the Business row). Never hardcode "he-IL" / "ILS" / "Asia/Jerusalem".
 *
 * Client-safe (no server imports).
 */
import { he, enUS } from "date-fns/locale";
import type { Locale as DateFnsLocale } from "date-fns";
import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { DEFAULT_LOCALE, LOCALE_CONFIG, isLocale, type Locale } from "./locale";

function cfgFor(locale: string | undefined) {
  return LOCALE_CONFIG[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

// ─── Currency ────────────────────────────────────────────────────────────────

export interface CurrencyOptions {
  locale: Locale | string;
  currency: string;
  /** Default: 0 for ILS (legacy Petra display), 2 (fixed, "$12.50") for every other currency */
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
}

export function formatCurrency(amount: number, opts: CurrencyOptions): string {
  const max = opts.maximumFractionDigits ?? (opts.currency === "ILS" ? 0 : 2);
  const min = Math.min(opts.minimumFractionDigits ?? (opts.currency === "ILS" ? 0 : max), max);
  return new Intl.NumberFormat(opts.locale, {
    style: "currency",
    currency: opts.currency,
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(amount);
}

// ─── Dates / times ───────────────────────────────────────────────────────────

export type DateStyle = "long" | "short" | "numeric" | "weekday" | "monthYear";

const DATE_STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  // "31 באוקטובר 2026" / "October 31, 2026"
  long: { day: "numeric", month: "long", year: "numeric" },
  // "31 באוק׳" / "Oct 31"
  short: { day: "numeric", month: "short" },
  // "31.10.2026" / "10/31/2026"
  numeric: { day: "2-digit", month: "2-digit", year: "numeric" },
  // "יום שישי, 31 באוקטובר" / "Friday, October 31"
  weekday: { weekday: "long", day: "numeric", month: "long" },
  // "אוקטובר 2026" / "October 2026"
  monthYear: { month: "long", year: "numeric" },
};

export interface DateOptions {
  locale: Locale | string;
  /** IANA zone. Omitted → the runtime's zone (legacy behaviour of utils.formatDate). */
  timezone?: string;
  style?: DateStyle;
}

export function formatDate(d: Date | string | number, opts: DateOptions): string {
  return new Intl.DateTimeFormat(opts.locale, {
    ...DATE_STYLES[opts.style ?? "long"],
    ...(opts.timezone ? { timeZone: opts.timezone } : {}),
  }).format(new Date(d));
}

export interface TimeOptions {
  locale: Locale | string;
  timezone?: string;
}

/**
 * Date → "14:30" (he-IL) / "2:30 PM" (en-US).
 * A wall-clock "HH:mm[:ss]" string (Appointment.startTime) is formatted without
 * any timezone conversion.
 */
export function formatTime(d: Date | string, opts: TimeOptions): string {
  const cfg = cfgFor(opts.locale);
  if (typeof d === "string" && /^\d{1,2}:\d{2}/.test(d)) {
    if (cfg.hourCycle === "h23") return d.slice(0, 5);
    const [h, m] = d.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
  }
  return new Intl.DateTimeFormat(opts.locale, {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: cfg.hourCycle,
    ...(opts.timezone ? { timeZone: opts.timezone } : {}),
  }).format(new Date(d));
}

/** The date-fns locale object for a Petra locale (for `format(d, "...", { locale })`). */
export function dateFnsLocaleFor(locale: Locale | string): DateFnsLocale {
  return cfgFor(locale).dateFnsLocale === "enUS" ? enUS : he;
}

// ─── Phone numbers ───────────────────────────────────────────────────────────

function parsePhone(phone: string, country: string) {
  if (!phone) return undefined;
  try {
    return parsePhoneNumberFromString(phone.trim(), country as CountryCode);
  } catch {
    return undefined;
  }
}

/** True when `phone` is a valid number for `country` (or a valid +E.164 number). */
export function validatePhone(phone: string, country: string): boolean {
  return parsePhone(phone, country)?.isValid() ?? false;
}

/** "+972541234567" / "+12125551234", or null when the number is not valid. */
export function toE164(phone: string, country: string): string | null {
  const p = parsePhone(phone, country);
  return p && p.isValid() ? p.number : null;
}

/**
 * National format for numbers of `country` ("054-123-4567", "(212) 555-1234"),
 * international format for foreign numbers, the raw input when unparseable.
 */
export function formatPhone(phone: string, country: string): string {
  const p = parsePhone(phone, country);
  if (!p || !p.isValid()) return phone;
  return p.country === country ? p.formatNational() : p.formatInternational();
}

/** "₪" for ILS, "$" for USD — for layouts that print the symbol next to a number. */
export function currencySymbol(opts: { locale: Locale | string; currency: string }): string {
  const part = new Intl.NumberFormat(opts.locale, { style: "currency", currency: opts.currency })
    .formatToParts(0)
    .find((p) => p.type === "currency");
  return part?.value ?? opts.currency;
}
