/**
 * AllDog voice agent ("אלירן") — free sales-call slots for Racheli (pure — no DB).
 *
 * Sales windows: Sun–Thu 10:00–12:00 and 16:00–18:00 Israel time, 20-minute calls back to
 * back (no buffer). A slot is offered only ≥ 2 hours from now, up to 5 workdays ahead, and
 * only when it does not overlap a scheduled LeadMeeting or a blocking AvailabilityBlock
 * (holiday = reason with "חג", like holidayBlocks; Racheli's own closure = reason with "מכירות").
 * Google Calendar busy times are never used here (Limited Use — same rule as MCP_SLOT_OPTS).
 */
import { addDaysYmd, heDayLabel, israelInstant, israelYmd, weekdayOfYmd } from "@/lib/alldog/time";

export const SALES_CALL_MINUTES = 20;
export const SALES_WINDOWS = [
  { start: "10:00", end: "12:00" },
  { start: "16:00", end: "18:00" },
] as const;
export const SALES_WEEKDAYS: readonly number[] = [0, 1, 2, 3, 4]; // Sunday–Thursday
export const SALES_MIN_NOTICE_MS = 2 * 60 * 60 * 1000;
export const SALES_WORKDAYS_AHEAD = 5;
export const SALES_SLOT_COUNT = 6;
/** Up to 2 slots per window, from the nearest windows that have room. */
export const SALES_SLOTS_PER_WINDOW = 2;
/** Inside one window the second slot is ≥ 40 minutes after the first when possible (not 10:00 + 10:20). */
export const SALES_SPREAD_MINUTES = 40;

/** AvailabilityBlock reasons that close sales windows: holidays (as holidayBlocks) and "מכירות". */
export const SALES_BLOCK_WORDS = ["חג", "מכירות"] as const;

export interface Interval { start: Date; end: Date }

export interface SalesSlot {
  ymd: string;      // YYYY-MM-DD, Israel calendar day
  hhmm: string;     // "10:20", Israel time
  startsAt: string; // ISO instant
  label: string;    // spoken: "היום בשעה 16:20" / "מחר בשעה 10:00" / "יום ראשון 15/11 בשעה 10:20"
}

export function isSalesBlockReason(reason: string | null | undefined): boolean {
  return !!reason && SALES_BLOCK_WORDS.some((w) => reason.includes(w));
}

/** The next `count` Sun–Thu days, today included when it is one. */
export function salesWorkdays(now: Date, count: number = SALES_WORKDAYS_AHEAD): string[] {
  const out: string[] = [];
  let ymd = israelYmd(now);
  for (let i = 0; i < 14 && out.length < count; i++) {
    if (SALES_WEEKDAYS.includes(weekdayOfYmd(ymd))) out.push(ymd);
    ymd = addDaysYmd(ymd, 1);
  }
  return out;
}

/** From the first window's start to the last window's end of the workdays (for the DB range queries). */
export function salesRange(days: string[]): Interval {
  const first = days[0];
  const last = days[days.length - 1];
  return {
    start: israelInstant(first, SALES_WINDOWS[0].start),
    end: israelInstant(last, SALES_WINDOWS[SALES_WINDOWS.length - 1].end),
  };
}

/** A LeadMeeting row (date = Israel day at 00:00Z, times Israel local) → its UTC interval. */
export function meetingInterval(m: { date: Date; startTime: string; endTime: string }): Interval {
  const ymd = m.date.toISOString().slice(0, 10);
  return { start: israelInstant(ymd, m.startTime), end: israelInstant(ymd, m.endTime) };
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

function toMinutes(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

function fromMinutes(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "היום בשעה 16:20" / "מחר בשעה 10:00" / "יום ראשון 15/11 בשעה 10:20". */
export function spokenSlotLabel(ymd: string, hhmm: string, now: Date): string {
  const today = israelYmd(now);
  if (ymd === today) return `היום בשעה ${hhmm}`;
  if (ymd === addDaysYmd(today, 1)) return `מחר בשעה ${hhmm}`;
  return `${heDayLabel(ymd)} בשעה ${hhmm}`;
}

interface Candidate { ymd: string; hhmm: string; minutes: number; start: Date }

/** Every free slot of every window, grouped by window, in time order. */
export function freeSlotsByWindow(now: Date, busy: Interval[], days: string[] = salesWorkdays(now)): Candidate[][] {
  const earliest = now.getTime() + SALES_MIN_NOTICE_MS;
  const windows: Candidate[][] = [];
  for (const ymd of days) {
    for (const w of SALES_WINDOWS) {
      const free: Candidate[] = [];
      for (let m = toMinutes(w.start); m + SALES_CALL_MINUTES <= toMinutes(w.end); m += SALES_CALL_MINUTES) {
        const hhmm = fromMinutes(m);
        const start = israelInstant(ymd, hhmm);
        if (start.getTime() < earliest) continue;
        const slot = { start, end: new Date(start.getTime() + SALES_CALL_MINUTES * 60 * 1000) };
        if (busy.some((b) => overlaps(slot, b))) continue;
        free.push({ ymd, hhmm, minutes: m, start });
      }
      windows.push(free);
    }
  }
  return windows;
}

/** Up to two slots of one window: the first free one, and one ≥ 40 min later (else the next free one). */
function pickFromWindow(free: Candidate[]): Candidate[] {
  if (!free.length) return [];
  const first = free[0];
  const second = free.find((c) => c.minutes - first.minutes >= SALES_SPREAD_MINUTES) ?? free[1];
  return second ? [first, second] : [first];
}

/**
 * Up to 6 slots spread over the nearest windows: ≤ 2 from each window that has room (the 3
 * nearest such windows fill 6; a window with a single free slot lets the next window in).
 * Still short after every window → the remaining free slots in time order. Sorted by time.
 */
export function pickSalesSlots(now: Date, busy: Interval[], days: string[] = salesWorkdays(now)): SalesSlot[] {
  const windows = freeSlotsByWindow(now, busy, days);
  const picked: Candidate[] = [];
  for (const free of windows) {
    if (picked.length >= SALES_SLOT_COUNT) break;
    picked.push(...pickFromWindow(free).slice(0, SALES_SLOT_COUNT - picked.length));
  }
  if (picked.length < SALES_SLOT_COUNT) {
    const taken = new Set(picked.map((c) => c.start.getTime()));
    for (const c of windows.flat()) {
      if (picked.length >= SALES_SLOT_COUNT) break;
      if (!taken.has(c.start.getTime())) picked.push(c);
    }
  }
  return picked
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((c) => ({ ymd: c.ymd, hhmm: c.hhmm, startsAt: c.start.toISOString(), label: spokenSlotLabel(c.ymd, c.hhmm, now) }));
}
