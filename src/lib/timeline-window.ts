/**
 * Pure window math for the boarding timeline's continuous horizontal scroll.
 *
 * The timeline renders a window of local day columns starting at `startKey`
 * ("YYYY-MM-DD"). When the user scrolls close to either end the window grows
 * (days appended / prepended); prepending moves every column right, so the
 * scroller must add `shiftPx` to its scrollLeft to keep the view still.
 */

export interface DayWindow {
  /** First day column, "YYYY-MM-DD". */
  startKey: string;
  /** Number of day columns. */
  days: number;
}

export const TL_WINDOW_BEFORE = 60;
export const TL_WINDOW_AFTER = 180;
/** Days added per extension. */
export const TL_EXTEND_DAYS = 90;
/** Extend when fewer than this many days are left beyond the visible edge. */
export const TL_EXTEND_THRESHOLD_DAYS = 21;
/** Hard cap — beyond it the far side is trimmed. */
export const TL_MAX_DAYS = 1100;

function parseKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function formatUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** key + n calendar days. */
export function addDayKey(key: string, n: number): string {
  return formatUtc(parseKey(key) + n * 86400000);
}

/** Whole days from key a to key b (b - a). */
export function dayKeyDiff(a: string, b: string): number {
  return Math.round((parseKey(b) - parseKey(a)) / 86400000);
}

/** Weekday of a day key (0 = Sunday). */
export function dayKeyWeekday(key: string): number {
  return new Date(parseKey(key)).getUTCDay();
}

export function windowAround(anchorKey: string, before = TL_WINDOW_BEFORE, after = TL_WINDOW_AFTER): DayWindow {
  return { startKey: addDayKey(anchorKey, -before), days: before + after };
}

/** True when `key` sits inside the window with at least `margin` days on each side. */
export function windowContains(win: DayWindow, key: string, margin = 0): boolean {
  const i = dayKeyDiff(win.startKey, key);
  return i >= margin && i < win.days - margin;
}

/** scrollLeft that puts `key` at the left edge of the track (with `leadDays` before it). */
export function scrollLeftForDay(win: DayWindow, key: string, dayW: number, leadDays = 1): number {
  return Math.max(0, (dayKeyDiff(win.startKey, key) - leadDays) * dayW);
}

/**
 * Grow the window when the visible area is near either end.
 * `viewportWidth` = width of the visible track (scroller width minus the sticky room column).
 * Returns null when nothing changes.
 */
export function extendWindowForScroll(
  win: DayWindow,
  pos: { scrollLeft: number; viewportWidth: number; dayW: number },
  opts: { extend?: number; threshold?: number; max?: number } = {},
): { win: DayWindow; shiftPx: number } | null {
  const extend = opts.extend ?? TL_EXTEND_DAYS;
  const threshold = opts.threshold ?? TL_EXTEND_THRESHOLD_DAYS;
  const max = opts.max ?? TL_MAX_DAYS;
  const { scrollLeft, viewportWidth, dayW } = pos;
  if (dayW <= 0) return null;
  const firstVisible = scrollLeft / dayW;
  const lastVisible = (scrollLeft + Math.max(0, viewportWidth)) / dayW;

  let startKey = win.startKey;
  let days = win.days;
  let shiftDays = 0;

  if (firstVisible < threshold) {
    startKey = addDayKey(startKey, -extend);
    days += extend;
    shiftDays += extend;
    if (days > max) days = max; // trim the far (right) end — no scroll change
  } else if (win.days - lastVisible < threshold) {
    days += extend;
    if (days > max) {
      const trim = days - max;
      // never trim days that are on screen
      const safeTrim = Math.min(trim, Math.max(0, Math.floor(firstVisible) - threshold));
      startKey = addDayKey(startKey, safeTrim);
      days -= safeTrim;
      shiftDays -= safeTrim;
    }
  } else {
    return null;
  }

  if (startKey === win.startKey && days === win.days) return null;
  return { win: { startKey, days }, shiftPx: shiftDays * dayW };
}

export interface MonthSegment {
  /** "YYYY-MM" */
  month: string;
  startIndex: number;
  length: number;
}

/** Consecutive month runs of the window (for the header's month labels). */
export function monthSegments(win: DayWindow): MonthSegment[] {
  const out: MonthSegment[] = [];
  let i = 0;
  while (i < win.days) {
    const key = addDayKey(win.startKey, i);
    const [y, m, d] = key.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const length = Math.min(daysInMonth - d + 1, win.days - i);
    out.push({ month: key.slice(0, 7), startIndex: i, length });
    i += length;
  }
  return out;
}

/** Index of the first column with the given weekday (0 = Sunday). */
export function firstWeekdayIndex(startKey: string, weekday: number): number {
  return (weekday - dayKeyWeekday(startKey) + 7) % 7;
}
