/**
 * Date helpers for reports (/analytics, /api/leads/reports).
 * Timestamps (createdAt, paidAt, wonAt…) are bucketed in Asia/Jerusalem.
 * Range params arrive as "YYYY-MM-DD" (Israel calendar days).
 */

const TZ = "Asia/Jerusalem";
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Valid "YYYY-MM-DD" between 2000 and 2100 (anything else is treated as junk input). */
export function isYmd(v: unknown): v is string {
  if (typeof v !== "string" || !YMD_RE.test(v)) return false;
  const year = Number(v.slice(0, 4));
  if (year < 2000 || year > 2100) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Offset (ms) of Asia/Jerusalem from UTC at the given instant (+2h / +3h). */
function israelOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Instant at which the Israel calendar day `ymd` starts. */
export function israelDayStart(ymd: string): Date {
  const utcMidnight = new Date(`${ymd}T00:00:00.000Z`);
  const guess = new Date(utcMidnight.getTime() - israelOffsetMs(utcMidnight));
  // Re-evaluate at the guess (handles DST switch days).
  return new Date(utcMidnight.getTime() - israelOffsetMs(guess));
}

/** Last millisecond of the Israel calendar day `ymd`. */
export function israelDayEnd(ymd: string): Date {
  const next = new Date(`${ymd}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return new Date(israelDayStart(next.toISOString().slice(0, 10)).getTime() - 1);
}

/** Israel-local YYYY-MM-DD of an instant. */
export function israelYmdOf(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Israel-local "YYYY-MM" of an instant. */
export function israelMonthKey(d: Date | string): string {
  return israelYmdOf(d).slice(0, 7);
}

/** Israel-local day of week of an instant (0 = Sunday). */
export function israelDayOfWeek(d: Date | string): number {
  const ymd = israelYmdOf(d);
  return new Date(`${ymd}T00:00:00.000Z`).getUTCDay();
}

/** The last `n` month keys ending with the month of `now` (oldest first). */
export function lastMonthKeys(n: number, now: Date = new Date()): string[] {
  const [y, m] = israelMonthKey(now).split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

/** Every month key from `from` to `to` inclusive (oldest first; if more than 72, keeps the LATEST 72). */
export function monthKeysBetween(from: Date, to: Date): string[] {
  const [fy, fm] = israelMonthKey(from).split("-").map(Number);
  const [ty, tm] = israelMonthKey(to).split("-").map(Number);
  const out: string[] = [];
  let y = fy;
  let m = fm;
  while ((y < ty || (y === ty && m <= tm)) && out.length < 1200) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out.length > 72 ? out.slice(-72) : out;
}

/** Same month key one year earlier ("2026-03" → "2025-03"). */
export function prevYearMonthKey(key: string): string {
  const [y, m] = key.split("-");
  return `${Number(y) - 1}-${m}`;
}

/** Whole days between two instants (floor, never negative). */
export function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86_400_000));
}

/** Integer percentage or null when the denominator is 0. */
export function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** Period-over-period change in %, null = "new" (previous 0, current > 0). */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/** Israel-local "today" as YYYY-MM-DD — use instead of toISOString().slice(0,10) in the browser too. */
export function israelTodayYmd(now: Date = new Date()): string {
  return israelYmdOf(now);
}
