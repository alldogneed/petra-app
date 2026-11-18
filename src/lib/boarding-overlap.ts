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

/**
 * Room CAPACITY rule = shared NIGHTS, Israel calendar days, hours ignored (גבעת הכלבים 18/11/2026:
 * a dog arriving in the morning and a dog leaving in the evening share a capacity-1 room every
 * day — the staff arrange them by hand). A stay takes the nights [check-in day, check-out day);
 * the check-out day is always free whatever the hour, and a same-day stay (day care) takes no
 * night, so it never blocks the room. Open-ended = every night from check-in.
 * (`staysOverlap` stays the display / duplicate-dog rule, where a day stay occupies its day.)
 */
export function staysShareNight(a: StayTimes, b: StayTimes): boolean {
  const aStart = israelDayKey(a.checkIn);
  const bStart = israelDayKey(b.checkIn);
  const aEnd = a.checkOut == null ? null : israelDayKey(a.checkOut);
  const bEnd = b.checkOut == null ? null : israelDayKey(b.checkOut);
  if (aEnd !== null && aEnd <= aStart) return false; // day stay — no night
  if (bEnd !== null && bEnd <= bStart) return false;
  return (aEnd === null || bStart < aEnd) && (bEnd === null || aStart < bEnd);
}
