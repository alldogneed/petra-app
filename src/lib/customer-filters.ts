/**
 * Customers list — filter / sort contract shared by the list page, GET /api/customers,
 * GET /api/customers/export and the service (src/services/customer-list.ts).
 * Pure + client-safe: no Prisma, no server imports.
 *
 * Status rules (single source of truth):
 *  - active  = upcoming scheduled appointment, OR a past non-canceled appointment within the
 *              last ACTIVE_VISIT_DAYS days, OR an active boarding stay (reserved/checked_in),
 *              OR an ACTIVE training program, OR created within NEW_CUSTOMER_DAYS days.
 *  - dormant = not active.
 *  - vip     = has a tag equal to "VIP" (case-insensitive, exact tag — not a substring).
 */
import { isYmd } from "@/lib/report-dates";

// ─── Allowlists ──────────────────────────────────────────────────────────────

export const CUSTOMER_STATUS_FILTERS = ["active", "dormant", "vip"] as const;
export const CUSTOMER_BALANCE_FILTERS = ["debt", "balanced"] as const;
export const CUSTOMER_LAST_VISIT_FILTERS = ["30", "60", "90", "never"] as const;
export const CUSTOMER_SPECIES_FILTERS = ["dog", "cat", "other"] as const;
export const CUSTOMER_SORTS = [
  "newest",
  "oldest",
  "name_asc",
  "balance_desc",
  "last_visit_desc",
  "last_visit_asc",
] as const;

export type CustomerStatusFilter = (typeof CUSTOMER_STATUS_FILTERS)[number];
export type CustomerBalanceFilter = (typeof CUSTOMER_BALANCE_FILTERS)[number];
export type CustomerLastVisitFilter = (typeof CUSTOMER_LAST_VISIT_FILTERS)[number];
export type CustomerSpeciesFilter = (typeof CUSTOMER_SPECIES_FILTERS)[number];
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

/** Sorts that need FINANCE_READ (fall back to "newest" without it). */
export const FINANCE_SORTS: readonly CustomerSort[] = ["balance_desc"];

export const CUSTOMER_SORT_LABELS: Record<CustomerSort, string> = {
  newest: "חדש לישן",
  oldest: "ישן לחדש",
  name_asc: "א-ב",
  balance_desc: "יתרת חוב (גבוה לנמוך)",
  last_visit_desc: "ביקור אחרון (חדש לישן)",
  last_visit_asc: "ביקור אחרון (ישן לחדש)",
};

export const ACTIVE_VISIT_DAYS = 60;
export const NEW_CUSTOMER_DAYS = 7;
export const SEARCH_MAX_LEN = 100;
export const TAG_MAX_LEN = 50;
export const SOURCE_MAX_LEN = 30;
export const MIN_PHONE_SEARCH_DIGITS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CustomerFilters {
  search: string | null;
  status: CustomerStatusFilter | null;
  balance: CustomerBalanceFilter | null;
  tag: string | null;
  lastVisit: CustomerLastVisitFilter | null;
  species: CustomerSpeciesFilter | null;
  source: string | null;
  createdFrom: string | null; // YYYY-MM-DD (Israel day)
  createdTo: string | null;   // YYYY-MM-DD (Israel day)
  minDebt: number | null;
  serviceType: string | null;
  sortBy: CustomerSort;
}

export const EMPTY_CUSTOMER_FILTERS: CustomerFilters = {
  search: null,
  status: null,
  balance: null,
  tag: null,
  lastVisit: null,
  species: null,
  source: null,
  createdFrom: null,
  createdTo: null,
  minDebt: null,
  serviceType: null,
  sortBy: "newest",
};

// ─── Parsing ─────────────────────────────────────────────────────────────────

type ParamSource = URLSearchParams | Record<string, string | null | undefined>;

function read(src: ParamSource, key: string): string | null {
  const v = src instanceof URLSearchParams ? src.get(key) : src[key];
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

function oneOf<T extends string>(v: string | null, list: readonly T[]): T | null {
  return v !== null && (list as readonly string[]).includes(v) ? (v as T) : null;
}

/** Strip control characters and cap length. */
export function cleanText(v: string | null, max: number): string | null {
  if (v === null) return null;
  // eslint-disable-next-line no-control-regex
  const t = v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  return t === "" ? null : t;
}

/**
 * Parse + validate list/export query params. Anything outside the allowlists is dropped
 * (never an error — a stale bookmark simply shows the unfiltered list).
 */
export function parseCustomerFilters(src: ParamSource): CustomerFilters {
  const createdFrom = read(src, "createdFrom");
  const createdTo = read(src, "createdTo");
  const minDebtRaw = read(src, "minDebt");
  const minDebtNum = minDebtRaw !== null ? Number(minDebtRaw) : NaN;
  const source = cleanText(read(src, "source"), SOURCE_MAX_LEN);
  const serviceType = read(src, "serviceType");

  let from = createdFrom && isYmd(createdFrom) ? createdFrom : null;
  let to = createdTo && isYmd(createdTo) ? createdTo : null;
  if (from && to && from > to) [from, to] = [to, from];

  return {
    search: cleanText(read(src, "search"), SEARCH_MAX_LEN),
    status: oneOf(read(src, "status"), CUSTOMER_STATUS_FILTERS),
    balance: oneOf(read(src, "balance"), CUSTOMER_BALANCE_FILTERS),
    tag: cleanText(read(src, "tag"), TAG_MAX_LEN),
    lastVisit: oneOf(read(src, "lastVisit"), CUSTOMER_LAST_VISIT_FILTERS),
    species: oneOf(read(src, "species"), CUSTOMER_SPECIES_FILTERS),
    source: source && /^[A-Za-z0-9_-]+$/.test(source) ? source : null,
    createdFrom: from,
    createdTo: to,
    minDebt: Number.isFinite(minDebtNum) && minDebtNum > 0 ? Math.min(minDebtNum, 10_000_000) : null,
    serviceType: serviceType && /^[a-z_]{1,30}$/.test(serviceType) ? serviceType : null,
    sortBy: oneOf(read(src, "sortBy"), CUSTOMER_SORTS) ?? "newest",
  };
}

/** Inverse of parseCustomerFilters — only non-default values are emitted. */
export function customerFiltersToParams(f: Partial<CustomerFilters>, params = new URLSearchParams()): URLSearchParams {
  const set = (k: string, v: string | number | null | undefined) => {
    if (v !== null && v !== undefined && v !== "") params.set(k, String(v));
  };
  set("search", f.search);
  set("status", f.status);
  set("balance", f.balance);
  set("tag", f.tag);
  set("lastVisit", f.lastVisit);
  set("species", f.species);
  set("source", f.source);
  set("createdFrom", f.createdFrom);
  set("createdTo", f.createdTo);
  set("minDebt", f.minDebt);
  set("serviceType", f.serviceType);
  if (f.sortBy && f.sortBy !== "newest") params.set("sortBy", f.sortBy);
  return params;
}

/** Number of active (non-search, non-sort) filters — for the "סינון (N)" badge. */
export function countActiveFilters(f: Partial<CustomerFilters>): number {
  return [
    f.status, f.balance, f.tag, f.lastVisit, f.species, f.source,
    f.createdFrom || f.createdTo, f.minDebt, f.serviceType,
  ].filter((v) => v !== null && v !== undefined && v !== "").length;
}

// ─── Search helpers ──────────────────────────────────────────────────────────

/** Escape LIKE/ILIKE wildcards (Postgres default escape char is backslash). */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Digits to match against a customer's phone (stripped of non-digits, leading 972 → 0),
 * or null when the search is not phone-like (letters, too few digits).
 */
export function normalizePhoneSearch(q: string | null | undefined): string | null {
  if (!q) return null;
  const t = q.trim();
  if (!/^[\d\s\-+().]+$/.test(t)) return null;
  let digits = t.replace(/\D/g, "");
  if (digits.startsWith("972")) digits = "0" + digits.slice(3);
  if (digits.length < MIN_PHONE_SEARCH_DIGITS) return null;
  return digits.slice(0, 20);
}

/** Same normalisation for a stored phone (used for comparisons on the client / in tests). */
export function normalizeStoredPhone(phone: string | null | undefined): string {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("972")) digits = "0" + digits.slice(3);
  return digits;
}

/** True when two phone strings are the same number (050-1234567 ≡ +972501234567). */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizeStoredPhone(a);
  return x.length >= 9 && x === normalizeStoredPhone(b);
}

// ─── Tags ────────────────────────────────────────────────────────────────────

export function parseTagList(tags: string | null | undefined): string[] {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export function isVipTag(tag: string): boolean {
  return tag.toLowerCase() === "vip";
}

export function hasVipTag(tags: string[] | string | null | undefined): boolean {
  const list = Array.isArray(tags) ? tags : parseTagList(tags);
  return list.some(isVipTag);
}

/** True when the JSON tag array contains exactly `tag`. */
export function hasExactTag(tags: string[] | string | null | undefined, tag: string): boolean {
  const list = Array.isArray(tags) ? tags : parseTagList(tags);
  return list.includes(tag);
}

/**
 * LIKE pattern matching an exact element of the JSON-encoded tag array
 * (`["a","b"]` LIKE `%"a"%`). Wildcards inside the tag are escaped.
 */
export function tagLikePattern(tag: string): string {
  return `%${escapeLike(JSON.stringify(tag))}%`;
}

/** Add / remove a tag; returns the new list (no duplicates, order kept). */
export function applyTagChange(tags: string[], action: "add_tag" | "remove_tag", tag: string): string[] {
  if (action === "add_tag") return tags.includes(tag) ? tags : [...tags, tag];
  return tags.filter((t) => t !== tag);
}

// ─── Status ──────────────────────────────────────────────────────────────────

export interface CustomerActivityFacts {
  createdAt: Date | string;
  /** Latest past non-canceled appointment date (Appointment.date), or null. */
  lastVisit: Date | string | null;
  hasUpcoming: boolean;
  inBoarding: boolean;
  activeTraining: boolean;
}

/**
 * `todayStart` = UTC midnight of today's Israel date — the same encoding as Appointment.date.
 * `now` = current instant (for createdAt, a real timestamp).
 */
export function isCustomerActive(f: CustomerActivityFacts, todayStart: Date, now: Date = new Date()): boolean {
  if (f.hasUpcoming || f.inBoarding || f.activeTraining) return true;
  if (f.lastVisit && new Date(f.lastVisit).getTime() >= todayStart.getTime() - ACTIVE_VISIT_DAYS * DAY_MS) return true;
  return new Date(f.createdAt).getTime() >= now.getTime() - NEW_CUSTOMER_DAYS * DAY_MS;
}

/** Display status: VIP wins, then active / dormant (kept for MCP + badges). */
export function displayStatus(isVip: boolean, isActive: boolean): "vip" | "active" | "dormant" {
  return isVip ? "vip" : isActive ? "active" : "dormant";
}

/**
 * Last-visit filter. "30" = visited, but not within the last 30 days (never-visited excluded);
 * "never" = no past non-canceled appointment at all.
 */
export function matchesLastVisit(
  filter: CustomerLastVisitFilter,
  lastVisit: Date | string | null,
  todayStart: Date
): boolean {
  if (filter === "never") return lastVisit === null;
  if (lastVisit === null) return false;
  const days = parseInt(filter, 10);
  return new Date(lastVisit).getTime() < todayStart.getTime() - days * DAY_MS;
}

/** Balance filter on an outstanding amount (customer-balance `outstanding`). */
export function matchesBalance(
  filter: CustomerBalanceFilter | null,
  minDebt: number | null,
  outstanding: number
): boolean {
  if (filter === "debt" && !(outstanding > 0)) return false;
  if (filter === "balanced" && outstanding > 0) return false;
  if (minDebt !== null && outstanding < minDebt) return false;
  return true;
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

/** Hebrew first, then Latin, then digits, then everything else (matches the old SQL order). */
export function nameBucket(name: string): number {
  const code = name.length ? name.charCodeAt(0) : 0;
  if (code >= 1488 && code <= 1514) return 0;
  if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) return 1;
  if (code >= 48 && code <= 57) return 2;
  return 3;
}

export function compareCustomerNames(a: { name: string; id: string }, b: { name: string; id: string }): number {
  const ba = nameBucket(a.name);
  const bb = nameBucket(b.name);
  if (ba !== bb) return ba - bb;
  const c = a.name.localeCompare(b.name, "he");
  if (c !== 0) return c;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface SortableCustomerRow {
  id: string;
  name: string;
  createdAt: Date | string;
  lastVisit?: Date | string | null;
  outstanding?: number;
}

function time(d: Date | string | null | undefined): number | null {
  return d === null || d === undefined ? null : new Date(d).getTime();
}

/** Sort rows in place-free fashion; ties broken deterministically by id. */
export function sortCustomerRows<T extends SortableCustomerRow>(rows: T[], sortBy: CustomerSort): T[] {
  const byId = (a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const out = [...rows];
  switch (sortBy) {
    case "name_asc":
      return out.sort(compareCustomerNames);
    case "oldest":
      return out.sort((a, b) => (time(a.createdAt)! - time(b.createdAt)!) || byId(a, b));
    case "balance_desc":
      return out.sort(
        (a, b) => (b.outstanding ?? 0) - (a.outstanding ?? 0) || compareCustomerNames(a, b)
      );
    case "last_visit_desc":
    case "last_visit_asc": {
      const dir = sortBy === "last_visit_desc" ? -1 : 1;
      return out.sort((a, b) => {
        const ta = time(a.lastVisit);
        const tb = time(b.lastVisit);
        if (ta === null && tb === null) return compareCustomerNames(a, b);
        if (ta === null) return 1; // never visited → always last
        if (tb === null) return -1;
        return (ta - tb) * dir || compareCustomerNames(a, b);
      });
    }
    case "newest":
    default:
      return out.sort((a, b) => (time(b.createdAt)! - time(a.createdAt)!) || -byId(a, b));
  }
}

// ─── Offset cursor ───────────────────────────────────────────────────────────

/** Offset cursors are plain digit strings; anything else is a keyset (customer id) cursor. */
export function parseOffsetCursor(cursor: string | null | undefined, max = 100_000): number | null {
  if (!cursor || !/^\d{1,7}$/.test(cursor)) return null;
  return Math.min(parseInt(cursor, 10), max);
}

// ─── WhatsApp personalisation ────────────────────────────────────────────────

/** Replace `{שם}` (and `{name}`) with the customer's first name. */
export function personalizeMessage(template: string, fullName: string): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  return template.replace(/\{שם\}|\{name\}/g, first);
}
