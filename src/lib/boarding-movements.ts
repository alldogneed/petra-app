/**
 * Check-in / check-out board (דור 23/11/2026, round 2). Pure: which stays arrive / leave on an
 * Israel calendar day and how many dogs sleep in the boarding at the end of that day.
 * Canceled stays are ignored. Days are Israel days ("YYYY-MM-DD", `israelDayKey`).
 */
import { israelDayKey } from "@/lib/boarding-overlap";

export interface MovementStay {
  id: string;
  checkIn: Date | string;
  checkOut: Date | string | null;
  status: string;
}

export interface DayMovement<T extends MovementStay> {
  day: string;
  arrivals: T[];
  departures: T[];
  /** Stays in the boarding at the end of the day (arrived on/before, leaving after this day or open-ended). */
  inBoarding: number;
}

const live = (s: MovementStay) => s.status !== "canceled";

export function arrivalsOn<T extends MovementStay>(stays: T[], day: string): T[] {
  return stays.filter((s) => live(s) && israelDayKey(s.checkIn) === day);
}

export function departuresOn<T extends MovementStay>(stays: T[], day: string): T[] {
  return stays.filter((s) => live(s) && s.checkOut != null && israelDayKey(s.checkOut) === day);
}

export function inBoardingAtEndOf(stays: MovementStay[], day: string): number {
  return stays.filter((s) => {
    if (!live(s)) return false;
    if (israelDayKey(s.checkIn) > day) return false;
    // checked out early: the stay is over on the day it actually ended
    if (s.checkOut == null) return s.status !== "checked_out";
    return israelDayKey(s.checkOut) > day;
  }).length;
}

export function dayMovement<T extends MovementStay>(stays: T[], day: string): DayMovement<T> {
  return { day, arrivals: arrivalsOn(stays, day), departures: departuresOn(stays, day), inBoarding: inBoardingAtEndOf(stays, day) };
}

/** "YYYY-MM-DD" + n days (calendar arithmetic, no time zone involved). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Sunday of the week that contains `day` (Israeli week: Sunday → Saturday). */
export function weekStart(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(day, -dow);
}

export interface WeekSummary<T extends MovementStay> {
  days: DayMovement<T>[];
  totalArrivals: number;
  totalDepartures: number;
}

export function weekSummary<T extends MovementStay>(stays: T[], start: string): WeekSummary<T> {
  const days = Array.from({ length: 7 }, (_, i) => dayMovement(stays, addDays(start, i)));
  return {
    days,
    totalArrivals: days.reduce((s, d) => s + d.arrivals.length, 0),
    totalDepartures: days.reduce((s, d) => s + d.departures.length, 0),
  };
}
