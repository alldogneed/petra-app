/**
 * Boarding care-log matching — shared by the daily board (/boarding/daily) and the
 * feeding board (/feeding) so a feeding or dose marked on one screen shows as done on
 * the other.
 *
 * Log titles written by each screen (kept as-is, no data migration):
 *   daily board   FEEDING    "האכלה 08:00"            MEDICATION  "<medName> 08:00" | "<medName>"
 *   feeding board FEEDING    "breakfast"|"lunch"|"dinner"  MEDICATION  "<medName>"
 */

export type MealSlot = "breakfast" | "lunch" | "dinner";

export interface CareLogLike {
  id: string;
  type: string;
  title: string;
}

const FEEDING_PREFIX = "האכלה ";
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Meal slot a clock time falls into: before 11:00 breakfast, before 16:00 lunch, else dinner. */
export function mealSlotForTime(time: string): MealSlot {
  const [h] = time.split(":").map(Number);
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  return "dinner";
}

export function feedingTitle(time: string): string {
  return FEEDING_PREFIX + time;
}

function feedingLogTime(log: CareLogLike): string | null {
  if (!log.title.startsWith(FEEDING_PREFIX)) return null;
  const t = log.title.slice(FEEDING_PREFIX.length).trim();
  return HHMM.test(t) ? t : null;
}

/** Daily board: the log for a feeding time (its own title, or the matching meal slot from /feeding). */
export function findFeedingLogForTime<T extends CareLogLike>(logs: T[], time: string): T | undefined {
  const feeding = logs.filter((l) => l.type === "FEEDING");
  return (
    feeding.find((l) => l.title === feedingTitle(time)) ??
    feeding.find((l) => l.title === mealSlotForTime(time))
  );
}

/** Feeding board: the log for a meal slot (its own title, or a daily-board time in that slot). */
export function findFeedingLogForSlot<T extends CareLogLike>(logs: T[], slot: MealSlot): T | undefined {
  const feeding = logs.filter((l) => l.type === "FEEDING");
  return (
    feeding.find((l) => l.title === slot) ??
    feeding.find((l) => {
      const t = feedingLogTime(l);
      return t !== null && mealSlotForTime(t) === slot;
    })
  );
}

/**
 * Dose times from `Medication.times`. Stored as free text ("07:00, 19:00" — the pet and
 * service-dog forms), older rows may hold a JSON array, and some hold words
 * ("morning,evening"). Returns clock times when there are any, otherwise [""] = one
 * untimed daily dose.
 */
export function parseMedTimes(times: string | null | undefined): string[] {
  if (!times || !times.trim()) return [""];
  let parts: string[] = [];
  try {
    const parsed = JSON.parse(times);
    if (Array.isArray(parsed)) parts = parsed.map(String);
  } catch {
    parts = times.split(/[,;\n|]+/);
  }
  const clock = parts
    .map((p) => p.trim())
    .map((p) => (/^\d:\d\d$/.test(p) ? "0" + p : p))
    .filter((p) => HHMM.test(p));
  return clock.length > 0 ? Array.from(new Set(clock)) : [""];
}

export function medicationTitle(medName: string, time?: string): string {
  return time ? `${medName} ${time}` : medName;
}

/**
 * Daily board: the log for one dose. A timed dose also accepts the untimed title that
 * /feeding writes, but only when the medication has a single dose time (otherwise one
 * mark on /feeding would tick every dose).
 */
export function findMedicationLog<T extends CareLogLike>(
  logs: T[],
  medName: string,
  time: string | undefined,
  doseCount: number,
): T | undefined {
  const meds = logs.filter((l) => l.type === "MEDICATION");
  const exact = meds.find((l) => l.title === medicationTitle(medName, time));
  if (exact || !time || doseCount !== 1) return exact;
  return meds.find((l) => l.title === medName);
}

/** Feeding board (one toggle per medication per day): any dose of this medication logged today. */
export function findAnyMedicationLog<T extends CareLogLike>(logs: T[], medName: string): T | undefined {
  return logs.find((l) => {
    if (l.type !== "MEDICATION") return false;
    if (l.title === medName) return true;
    if (!l.title.startsWith(medName + " ")) return false;
    return HHMM.test(l.title.slice(medName.length + 1).trim());
  });
}
