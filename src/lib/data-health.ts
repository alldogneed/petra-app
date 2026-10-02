/**
 * Data-health ("בריאות נתונים") — pure helpers shared by the service
 * (src/services/business-admin-health.ts) and the UI (DataHealthTab).
 * Client-safe: no prisma, no env.
 */

export type DataHealthSeverity = "high" | "medium" | "low";

export interface DataHealthItem {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
}

export interface DataHealthCheck {
  key: string;
  title: string;
  description: string;
  severity: DataHealthSeverity;
  count: number;
  items: DataHealthItem[];
  fixHint: string;
}

export interface DataHealthReport {
  generatedAt: string;
  score: number;
  checks: DataHealthCheck[];
}

export const DATA_HEALTH_MAX_ITEMS = 10;

export const SEVERITY_PENALTY: Record<DataHealthSeverity, number> = { high: 15, medium: 8, low: 3 };
const SEVERITY_RANK: Record<DataHealthSeverity, number> = { high: 0, medium: 1, low: 2 };

/** 100 minus a fixed penalty per failing check (count > 0), floored at 0. */
export function computeHealthScore(checks: Pick<DataHealthCheck, "severity" | "count">[]): number {
  let score = 100;
  for (const c of checks) {
    if (c.count > 0) score -= SEVERITY_PENALTY[c.severity] ?? 0;
  }
  return Math.max(0, Math.min(100, score));
}

/** Severity (high first), then count desc, then key for stability. */
export function sortChecks<T extends Pick<DataHealthCheck, "severity" | "count" | "key">>(checks: T[]): T[] {
  return [...checks].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.count - a.count ||
      a.key.localeCompare(b.key)
  );
}

export function healthVerdict(score: number): { label: string; tone: "good" | "fair" | "poor" } {
  if (score >= 90) return { label: "מצוין — הנתונים מסודרים", tone: "good" };
  if (score >= 70) return { label: "טוב — יש כמה דברים לסדר", tone: "fair" };
  if (score >= 40) return { label: "דורש תשומת לב", tone: "poor" };
  return { label: "דורש טיפול דחוף", tone: "poor" };
}

/** Mask a phone so only the last 4 digits are visible ("•••••4567"). */
export function maskPhone(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 4) return "•".repeat(digits.length);
  return "•".repeat(Math.min(digits.length - 4, 8)) + digits.slice(-4);
}

/** Trim + collapse whitespace + cap length for customer-controlled labels. */
export function cleanLabel(value: string | null | undefined, max = 60): string {
  const s = (value ?? "").replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "ללא שם";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ─── Vaccinations ────────────────────────────────────────────────────────────
// Validity windows mirror services/pets.ts buildAllVaccineEntries() (the logic
// behind list_expiring_vaccinations): rabies = rabiesValidUntil, DHPP adult +365d,
// puppy doses 1/2 +14d, puppy dose 3 +365d. Bordetella has no validity → never
// "expired". Parasite treatments (park worm / deworming / flea-tick) are not
// vaccinations and are intentionally left out of this check.

const DAY_MS = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

export interface VaccineHealthFields {
  rabiesLastDate?: Date | null;
  rabiesValidUntil: Date | null;
  rabiesUnknown: boolean;
  dhppLastDate: Date | null;
  dhppPuppy1Date: Date | null;
  dhppPuppy2Date: Date | null;
  dhppPuppy3Date: Date | null;
  bordatellaDate: Date | null;
}

/** True when the pet has at least one recorded vaccination date. */
export function hasAnyVaccinationRecord(h: VaccineHealthFields | null | undefined): boolean {
  if (!h) return false;
  return Boolean(
    h.rabiesLastDate || h.rabiesValidUntil || h.dhppLastDate ||
    h.dhppPuppy1Date || h.dhppPuppy2Date || h.dhppPuppy3Date || h.bordatellaDate
  );
}

/**
 * Hebrew labels of the vaccines that are expired as of `todayStart` (valid-until
 * strictly before today). A puppy dose superseded by a later dose / adult DHPP
 * is not reported (otherwise every vaccinated puppy would show "expired dose 1").
 */
export function expiredVaccineLabels(h: VaccineHealthFields, todayStart: Date): string[] {
  const out: string[] = [];
  const expired = (validUntil: Date | null) => validUntil !== null && validUntil.getTime() < todayStart.getTime();

  if (!h.rabiesUnknown && expired(h.rabiesValidUntil)) out.push("כלבת");

  // DHPP: only the most recent dose in the series counts.
  if (h.dhppLastDate) {
    if (expired(addDays(h.dhppLastDate, 365))) out.push("משושה");
  } else if (h.dhppPuppy3Date) {
    if (expired(addDays(h.dhppPuppy3Date, 365))) out.push("משושה");
  } else if (h.dhppPuppy2Date) {
    if (expired(addDays(h.dhppPuppy2Date, 14))) out.push("משושה גורים (מנה 3 חסרה)");
  } else if (h.dhppPuppy1Date) {
    if (expired(addDays(h.dhppPuppy1Date, 14))) out.push("משושה גורים (מנה 2 חסרה)");
  }
  return out;
}

/** DB pre-filter cutoffs (anything that could be expired as of todayStart). */
export function vaccineExpiryCutoffs(todayStart: Date) {
  return {
    rabies: todayStart,
    dhppAdult: addDays(todayStart, -365),
    puppy3: addDays(todayStart, -365),
    puppyShort: addDays(todayStart, -14),
  };
}
