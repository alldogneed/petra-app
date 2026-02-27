/**
 * Minimal RRULE utilities for Petra's task recurrence system.
 * Supports FREQ=DAILY, WEEKLY, MONTHLY with INTERVAL and BYDAY.
 * Format: "FREQ=DAILY;INTERVAL=1" or "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR"
 */

const DAY_OF_WEEK_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

interface ParsedRrule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  byDay: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

export function parseRrule(rrule: string): ParsedRrule {
  const parts = rrule.split(";");
  const map: Record<string, string> = {};
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key && value !== undefined) map[key.trim()] = value.trim();
  }

  const freq = (map["FREQ"] ?? "DAILY") as ParsedRrule["freq"];
  const interval = parseInt(map["INTERVAL"] ?? "1", 10) || 1;
  const byDayStr = map["BYDAY"] ?? "";
  const byDay = byDayStr
    ? byDayStr.split(",").map((d) => DAY_OF_WEEK_MAP[d.trim().toUpperCase()] ?? -1).filter((d) => d >= 0)
    : [];

  return { freq, interval, byDay };
}

export function buildRruleString(
  freq: "DAILY" | "WEEKLY" | "MONTHLY",
  interval: number,
  byDay?: number[]
): string {
  const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  let rule = `FREQ=${freq};INTERVAL=${interval}`;
  if (freq === "WEEKLY" && byDay && byDay.length > 0) {
    rule += `;BYDAY=${byDay.map((d) => dayNames[d]).join(",")}`;
  }
  return rule;
}

/**
 * Generates occurrence dates for a rule within a date window.
 * Returns dates (as Date objects) where tasks should be created.
 */
export function buildRruleDates(
  rrule: string,
  startAt: Date,
  windowStart: Date,
  windowEnd: Date,
  endAt: Date | null
): Date[] {
  const { freq, interval, byDay } = parseRrule(rrule);
  const dates: Date[] = [];

  // Effective end is the earlier of windowEnd and rule endAt
  const effectiveEnd = endAt && new Date(endAt) < windowEnd ? new Date(endAt) : windowEnd;

  // Start iteration from the later of startAt and windowStart
  const cursor = new Date(Math.max(new Date(startAt).getTime(), windowStart.getTime()));
  cursor.setHours(0, 0, 0, 0);

  const normalizedStart = new Date(startAt);
  normalizedStart.setHours(0, 0, 0, 0);

  const dayMs = 24 * 60 * 60 * 1000;
  const maxIterations = 10000; // safety limit
  let iterations = 0;

  if (freq === "DAILY") {
    // Find first occurrence on or after cursor that aligns with interval
    const daysDiff = Math.ceil((cursor.getTime() - normalizedStart.getTime()) / dayMs);
    const firstAlignedDiff = Math.ceil(daysDiff / interval) * interval;
    const current = new Date(normalizedStart.getTime() + firstAlignedDiff * dayMs);

    let d = new Date(current);
    while (d <= effectiveEnd && iterations < maxIterations) {
      if (d >= windowStart) dates.push(new Date(d));
      d = new Date(d.getTime() + interval * dayMs);
      iterations++;
    }
  } else if (freq === "WEEKLY") {
    const targetDays = byDay.length > 0 ? byDay : [normalizedStart.getDay()];
    const weekMs = 7 * dayMs;
    const intervalWeekMs = interval * weekMs;

    // Find the start of the week aligned with startAt
    const startWeek = new Date(normalizedStart);
    startWeek.setDate(startWeek.getDate() - startWeek.getDay()); // go back to Sunday

    // Find the cursor's aligned week
    const cursorWeek = new Date(cursor);
    cursorWeek.setDate(cursorWeek.getDate() - cursorWeek.getDay());

    const weeksDiff = Math.ceil((cursorWeek.getTime() - startWeek.getTime()) / weekMs);
    const alignedWeeksDiff = Math.ceil(weeksDiff / interval) * interval;

    let weekStart = new Date(startWeek.getTime() + alignedWeeksDiff * weekMs);

    while (weekStart <= effectiveEnd && iterations < maxIterations) {
      for (const dayOfWeek of targetDays) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + dayOfWeek);
        if (d >= windowStart && d <= effectiveEnd) {
          dates.push(new Date(d));
        }
      }
      weekStart = new Date(weekStart.getTime() + intervalWeekMs);
      iterations++;
    }
  } else if (freq === "MONTHLY") {
    // Monthly: same day of month as startAt, every N months
    const startDay = normalizedStart.getDate();

    // Find first month on or after cursor aligned with interval
    const startMonthOffset = normalizedStart.getFullYear() * 12 + normalizedStart.getMonth();
    const cursorMonthOffset = cursor.getFullYear() * 12 + cursor.getMonth();
    const monthsDiff = Math.max(0, cursorMonthOffset - startMonthOffset);
    const alignedMonthsDiff = Math.ceil(monthsDiff / interval) * interval;

    let currentMonthOffset = startMonthOffset + alignedMonthsDiff;

    while (iterations < maxIterations) {
      const year = Math.floor(currentMonthOffset / 12);
      const month = currentMonthOffset % 12;
      const d = new Date(year, month, startDay);
      if (d > effectiveEnd) break;
      if (d >= windowStart) dates.push(d);
      currentMonthOffset += interval;
      iterations++;
    }
  }

  // Sort and deduplicate
  dates.sort((a, b) => a.getTime() - b.getTime());
  const unique: Date[] = [];
  let prev: number | null = null;
  for (const d of dates) {
    const t = d.setHours(0, 0, 0, 0);
    if (t !== prev) {
      unique.push(new Date(t));
      prev = t;
    }
  }

  return unique;
}

export function humanizeRrule(rrule: string): string {
  const { freq, interval, byDay } = parseRrule(rrule);
  const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

  if (freq === "DAILY") {
    if (interval === 1) return "כל יום";
    return `כל ${interval} ימים`;
  }
  if (freq === "WEEKLY") {
    const days = byDay.length > 0 ? byDay.map((d) => dayNames[d]).join(", ") : "כל שבוע";
    if (interval === 1) return `שבועי – ${days}`;
    return `כל ${interval} שבועות – ${days}`;
  }
  if (freq === "MONTHLY") {
    if (interval === 1) return "כל חודש";
    return `כל ${interval} חודשים`;
  }
  return rrule;
}
