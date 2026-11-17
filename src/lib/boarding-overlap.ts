/**
 * Room occupancy for boarding stays, by Israel calendar day.
 * A stay occupies the nights from its check-in day up to (not including) its
 * check-out day — the check-out day is a turnover day: a dog leaving on 1/10 and
 * a dog arriving on 1/10 can share the room. A same-day stay (day care) occupies
 * its one day. A missing check-out = open-ended.
 * Pure + client-safe (used by the service, MCP and the boarding screen).
 */
const DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" of the instant in Israel. A bare "YYYY-MM-DD" string is returned as is. */
export function israelDayKey(d: Date | string): string {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return DAY_FMT.format(typeof d === "string" ? new Date(d) : d);
}

export function nextDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return t.toISOString().slice(0, 10);
}

/** Occupied day range [start, end) as day keys; end null = open-ended. */
export function occupiedDays(checkIn: Date | string, checkOut: Date | string | null | undefined): [string, string | null] {
  const start = israelDayKey(checkIn);
  if (checkOut == null) return [start, null];
  let end = israelDayKey(checkOut);
  if (end <= start) end = nextDayKey(start);
  return [start, end];
}

export function staysOverlap(
  a: { checkIn: Date | string; checkOut: Date | string | null | undefined },
  b: { checkIn: Date | string; checkOut: Date | string | null | undefined },
): boolean {
  const [aStart, aEnd] = occupiedDays(a.checkIn, a.checkOut);
  const [bStart, bEnd] = occupiedDays(b.checkIn, b.checkOut);
  return (aEnd === null || bStart < aEnd) && (bEnd === null || aStart < bEnd);
}

type StayTimes = { checkIn: Date | string; checkOut: Date | string | null | undefined };

function instantOf(v: Date | string): number | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return null; // a bare day has no time
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Room CAPACITY overlap by actual date + time (גבעת הכלבים 17/11/2026): a dog that leaves at
 * 17:00 and a dog that arrives at 19:00 the same day can share a capacity-1 room, and a day
 * stay (09:00–16:00) no longer blocks the night after it. Half-open [checkIn, checkOut), so
 * out 12:00 / in 12:00 fits. Falls back to the day rule (`staysOverlap`) when a side has no
 * time (bare "YYYY-MM-DD") or a zero / negative length. Open-ended = no end.
 */
export function staysOverlapAt(a: StayTimes, b: StayTimes): boolean {
  const aIn = instantOf(a.checkIn);
  const bIn = instantOf(b.checkIn);
  const aOut = a.checkOut == null ? Infinity : instantOf(a.checkOut);
  const bOut = b.checkOut == null ? Infinity : instantOf(b.checkOut);
  if (aIn == null || bIn == null || aOut == null || bOut == null || aOut <= aIn || bOut <= bIn) {
    return staysOverlap(a, b);
  }
  return aIn < bOut && bIn < aOut;
}
