/**
 * Lead traffic attribution — single source of truth.
 *
 * `Lead.source` (existing) = intake channel chosen by the business ("manual",
 * "website", "google"…). `Lead.trafficSource` (this module) = where the visitor
 * actually came from, derived from UTM / gclid / referrer sent by the website
 * (all-dog.co.il) or any webhook client. Both coexist; nothing here touches
 * `Lead.source`.
 *
 * Pure module — no Prisma, no Next — so it is unit-testable.
 */

export const TRAFFIC_SOURCES = [
  "organic",
  "paid",
  "direct",
  "referral",
  "social",
  "whatsapp",
  "phone",
  "unknown",
] as const;
export type TrafficSource = (typeof TRAFFIC_SOURCES)[number];

export const TRAFFIC_SOURCE_LABELS: Record<TrafficSource, string> = {
  organic: "אורגני",
  paid: "ממומן",
  direct: "ישיר",
  referral: "הפניה",
  social: "רשתות חברתיות",
  whatsapp: "וואטסאפ",
  phone: "טלפון",
  unknown: "לא ידוע",
};

export const PAGE_TYPES = ["service", "guide", "area", "tool", "home"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  service: "שירות",
  guide: "מדריך",
  area: "אזור",
  tool: "כלי",
  home: "דף הבית",
};

/** Attribution columns as stored on `Lead`. All nullable except trafficSource. */
export interface LeadAttribution {
  trafficSource: TrafficSource;
  medium: string | null;
  campaign: string | null;
  landingPage: string | null;
  referrer: string | null;
  firstPage: string | null;
  gclid: string | null;
  pageType: PageType | null;
}

/**
 * Raw attribution as it may arrive from a website / Make webhook / UI form.
 * Every key optional; snake_case and camelCase both accepted by `normalizeAttributionInput`.
 */
export interface AttributionInput {
  trafficSource?: string | null;
  utmSource?: string | null;
  medium?: string | null;
  campaign?: string | null;
  landingPage?: string | null;
  referrer?: string | null;
  firstPage?: string | null;
  gclid?: string | null;
  pageType?: string | null;
}

const MAX_URL = 2048;
const MAX_SHORT = 200;

const PAID_MEDIUMS = new Set(["cpc", "ppc", "paid", "paidsearch", "paid_search", "paid-search", "cpm", "display", "paid_social", "paidsocial"]);
const SEARCH_ENGINE_HOSTS = ["google.", "bing.", "yahoo.", "duckduckgo.", "yandex.", "ecosia."];
const SOCIAL_HOSTS = ["facebook.", "fb.com", "instagram.", "tiktok.", "linkedin.", "twitter.", "x.com", "t.co", "youtube.", "youtu.be", "pinterest.", "threads.net", "l.facebook.com", "lm.facebook.com", "l.instagram.com"];
const WHATSAPP_HOSTS = ["whatsapp.", "wa.me", "api.whatsapp.com"];

/** Lowercased hostname of a URL/host string, or "" when unparseable. */
export function hostOf(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.trim();
  if (!s) return "";
  try {
    const url = new URL(s.includes("://") ? s : `https://${s}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return s.toLowerCase().replace(/^www\./, "").split("/")[0] ?? "";
  }
}

function hostMatches(host: string, needles: readonly string[]): boolean {
  if (!host) return false;
  return needles.some((n) => host === n || host.includes(n) || host.endsWith(n.replace(/\.$/, "")));
}

export function isTrafficSource(v: unknown): v is TrafficSource {
  return typeof v === "string" && (TRAFFIC_SOURCES as readonly string[]).includes(v);
}

export function isPageType(v: unknown): v is PageType {
  return typeof v === "string" && (PAGE_TYPES as readonly string[]).includes(v);
}

/**
 * Classification rule (spec):
 *   utm_medium ∈ {cpc, ppc, …} OR gclid present         → paid
 *   referrer from google/bing (no gclid)                  → organic
 *   referrer from facebook/instagram (or utm_source same) → social
 *   whatsapp referrer / utm_source                        → whatsapp
 *   nothing at all (no referrer, no utm, no gclid)        → direct
 *   anything else                                         → referral
 *
 * An explicit, valid `trafficSource` from the client wins over inference.
 */
export function classifyTrafficSource(input: AttributionInput): TrafficSource {
  if (isTrafficSource(input.trafficSource)) return input.trafficSource;

  const medium = (input.medium ?? "").trim().toLowerCase();
  const utmSource = (input.utmSource ?? "").trim().toLowerCase();
  const gclid = (input.gclid ?? "").trim();
  const refHost = hostOf(input.referrer);

  if (gclid || PAID_MEDIUMS.has(medium)) return "paid";

  if (medium === "whatsapp" || utmSource.includes("whatsapp") || hostMatches(refHost, WHATSAPP_HOSTS)) {
    return "whatsapp";
  }
  if (medium === "phone" || medium === "call" || utmSource === "phone") return "phone";

  if (medium === "organic" && !utmSource) return "organic";
  if (hostMatches(refHost, SEARCH_ENGINE_HOSTS)) return "organic";
  if (medium === "organic" && SEARCH_ENGINE_HOSTS.some((h) => utmSource.includes(h.replace(/\.$/, "")))) return "organic";

  if (medium === "social" || hostMatches(refHost, SOCIAL_HOSTS) || SOCIAL_HOSTS.some((h) => utmSource.includes(h.replace(/\.$/, "").replace(/\.com$/, "")))) {
    return "social";
  }

  if (medium === "referral") return "referral";
  if (medium === "email" || medium === "sms") return "referral";

  const nothing = !refHost && !medium && !utmSource && !input.campaign;
  if (nothing) return "direct";

  return "referral";
}

function cleanStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, max);
  return s || null;
}

/** Keep only a path (+query) for pages; full URLs are reduced to path so reports group cleanly. */
export function normalizePagePath(v: unknown, max = MAX_URL): string | null {
  const s = cleanStr(v, max);
  if (!s) return null;
  if (s.includes("://")) {
    try {
      const u = new URL(s);
      const path = `${u.pathname}${u.search}` || "/";
      return path.slice(0, max);
    } catch {
      return s;
    }
  }
  return s.startsWith("/") ? s : `/${s}`;
}

/**
 * Accepts a loose webhook/UI body and returns a typed, length-limited
 * attribution object ready for `prisma.lead.create`. Invalid values are
 * dropped (never throws). When the body carries no attribution keys at all
 * (older client) trafficSource stays "unknown"; when keys are present but
 * empty the visit is classified "direct" per spec.
 */
export function normalizeAttributionInput(body: Record<string, unknown>): LeadAttribution {
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      const v = body[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };

  const raw: AttributionInput = {
    trafficSource: cleanStr(pick("traffic_source", "trafficSource", "source_type"), MAX_SHORT)?.toLowerCase() ?? null,
    utmSource: cleanStr(pick("utm_source", "utmSource"), MAX_SHORT),
    medium: cleanStr(pick("medium", "utm_medium", "utmMedium"), MAX_SHORT),
    campaign: cleanStr(pick("campaign", "utm_campaign", "utmCampaign"), MAX_SHORT),
    landingPage: cleanStr(pick("landing_page", "landingPage"), MAX_URL),
    referrer: cleanStr(pick("referrer", "referer", "http_referer"), MAX_URL),
    firstPage: cleanStr(pick("first_page", "firstPage"), MAX_URL),
    gclid: cleanStr(pick("gclid"), MAX_SHORT),
    pageType: cleanStr(pick("page_type", "pageType"), MAX_SHORT)?.toLowerCase() ?? null,
  };

  const trafficSource = hasAttributionPayload(body) ? classifyTrafficSource(raw) : "unknown";

  return {
    trafficSource,
    medium: raw.medium ? raw.medium.toLowerCase() : null,
    campaign: raw.campaign ?? null,
    landingPage: normalizePagePath(raw.landingPage),
    referrer: raw.referrer ?? null,
    firstPage: normalizePagePath(raw.firstPage),
    gclid: raw.gclid ?? null,
    pageType: isPageType(raw.pageType) ? raw.pageType : null,
  };
}

const ATTRIBUTION_KEYS = [
  "traffic_source", "trafficSource", "source_type",
  "utm_source", "utmSource", "medium", "utm_medium", "utmMedium",
  "campaign", "utm_campaign", "utmCampaign",
  "landing_page", "landingPage", "referrer", "referer", "http_referer",
  "first_page", "firstPage", "gclid", "page_type", "pageType",
] as const;

/**
 * True when the client sent ANY attribution key (even empty strings).
 * Presence of the keys means the site tracked the visit, so "everything empty"
 * legitimately means a direct visit. Absence means an older client — keep "unknown".
 */
export function hasAttributionPayload(body: Record<string, unknown>): boolean {
  return ATTRIBUTION_KEYS.some((k) => Object.prototype.hasOwnProperty.call(body, k));
}

/** "מקור: אורגני · עמוד: /guides/…" — one-line summary for cards. Returns null when nothing to show. */
export function formatAttributionLine(
  a: { trafficSource?: string | null; landingPage?: string | null } | null | undefined
): string | null {
  if (!a) return null;
  const parts: string[] = [];
  if (a.trafficSource && a.trafficSource !== "unknown") {
    parts.push(`מקור: ${isTrafficSource(a.trafficSource) ? TRAFFIC_SOURCE_LABELS[a.trafficSource] : a.trafficSource}`);
  }
  if (a.landingPage) parts.push(`עמוד: ${a.landingPage}`);
  return parts.length ? parts.join(" · ") : null;
}

// ─── Reports ────────────────────────────────────────────────────────────────

export interface AttributionLeadRow {
  createdAt: Date | string;
  trafficSource: string | null;
  landingPage: string | null;
  wonAt: Date | string | null;
}

export interface LeadAttributionReport {
  /** "YYYY-MM" keys, oldest → newest, always 12 entries. */
  months: string[];
  /** One row per traffic source that has at least one lead; counts aligned with `months`. */
  bySourceByMonth: { source: TrafficSource; counts: number[]; total: number }[];
  /** Top landing pages over the whole window. */
  byLandingPage: { page: string; count: number; won: number }[];
  totalLeads: number;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** First day of the month 11 months before `now` — the report window start. */
export function attributionWindowStart(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() - 11, 1);
}

/** Pure aggregation for the analytics page: leads per source per month + per landing page (12 months). */
export function buildLeadAttributionReport(
  leads: AttributionLeadRow[],
  now: Date = new Date(),
  topPages = 20
): LeadAttributionReport {
  const start = attributionWindowStart(now);
  const months: string[] = [];
  for (let i = 0; i < 12; i++) months.push(monthKey(new Date(start.getFullYear(), start.getMonth() + i, 1)));
  const monthIndex = new Map(months.map((m, i) => [m, i]));

  const bySource = new Map<TrafficSource, number[]>();
  const byPage = new Map<string, { count: number; won: number }>();
  let totalLeads = 0;

  for (const l of leads) {
    const created = l.createdAt instanceof Date ? l.createdAt : new Date(l.createdAt);
    const idx = monthIndex.get(monthKey(created));
    if (idx === undefined) continue; // outside window (or invalid date)
    totalLeads += 1;

    const src: TrafficSource = isTrafficSource(l.trafficSource) ? l.trafficSource : "unknown";
    if (!bySource.has(src)) bySource.set(src, new Array(12).fill(0));
    bySource.get(src)![idx] += 1;

    if (l.landingPage) {
      const entry = byPage.get(l.landingPage) ?? { count: 0, won: 0 };
      entry.count += 1;
      if (l.wonAt) entry.won += 1;
      byPage.set(l.landingPage, entry);
    }
  }

  const bySourceByMonth = TRAFFIC_SOURCES
    .filter((s) => bySource.has(s))
    .map((source) => {
      const counts = bySource.get(source)!;
      return { source, counts, total: counts.reduce((a, b) => a + b, 0) };
    })
    .sort((a, b) => b.total - a.total);

  const byLandingPage = Array.from(byPage.entries())
    .map(([page, v]) => ({ page, ...v }))
    .sort((a, b) => b.count - a.count || a.page.localeCompare(b.page))
    .slice(0, topPages);

  return { months, bySourceByMonth, byLandingPage, totalLeads };
}

/** "09/25" style label for a "YYYY-MM" key (Hebrew UI uses numeric months). */
export function formatMonthKey(key: string): string {
  const [y, m] = key.split("-");
  return `${m}/${y.slice(2)}`;
}
