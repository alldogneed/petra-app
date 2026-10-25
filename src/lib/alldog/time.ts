/**
 * Israel-time helpers for the AllDog automations (pure — no DB).
 * Never `new Date("YYYY-MM-DDTHH:MM")`: that is server-local (UTC on Vercel).
 */

interface IsraelParts { ymd: string; hhmm: string; weekday: number } // weekday 0 = Sunday

export function israelParts(d: Date): IsraelParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { ymd: `${get("year")}-${get("month")}-${get("day")}`, hhmm: `${get("hour")}:${get("minute")}`, weekday: wd };
}

export function israelYmd(d: Date = new Date()): string {
  return israelParts(d).ymd;
}

/** dd/mm/yyyy of the Israel calendar day (PayCall downloadRecord `from`). */
export function israelDdMmYyyy(d: Date): string {
  const [y, m, day] = israelYmd(d).split("-");
  return `${day}/${m}/${y}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOfYmd(ymd: string): number {
  return new Date(`${ymd}T00:00:00.000Z`).getUTCDay();
}

/** Strict YYYY-MM-DD (rejects 2026-02-30). */
export function isValidYmd(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function isValidHhmm(s: unknown): s is string {
  return typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** "+03:00" / "+02:00" — Israel's UTC offset at an instant. */
function jerusalemOffset(at: Date): string {
  const tz = new Intl.DateTimeFormat("en", { timeZone: "Asia/Jerusalem", timeZoneName: "shortOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT+2";
  const m = tz.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!m) return "+02:00";
  return `${m[1]}${m[2].padStart(2, "0")}:${(m[3] ?? "0").padStart(2, "0")}`;
}

/** Israel wall time → true UTC instant (offset taken at that wall time, DST-safe outside the switch hour). */
export function israelInstant(ymd: string, hhmm: string): Date {
  const guess = new Date(`${ymd}T${hhmm}:00+02:00`);
  return new Date(`${ymd}T${hhmm}:00${jerusalemOffset(guess)}`);
}

const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** "יום שלישי 28/10" */
export function heDayLabel(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `יום ${HE_DAYS[weekdayOfYmd(ymd)]} ${Number(d)}/${Number(m)}`;
}

// ─── AllDog office hours: Sun–Thu 09:00–17:00, Fri 09:00–14:00 ──────────────

export function officeHoursFor(weekday: number): { open: string; close: string } | null {
  if (weekday >= 0 && weekday <= 4) return { open: "09:00", close: "17:00" };
  if (weekday === 5) return { open: "09:00", close: "14:00" };
  return null; // Saturday
}

/** A callback slot is valid when it starts inside office hours (last slot = 30 min before closing). */
export function isWithinOfficeHours(ymd: string, hhmm: string): boolean {
  const h = officeHoursFor(weekdayOfYmd(ymd));
  if (!h) return false;
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return mins(hhmm) >= mins(h.open) && mins(hhmm) <= mins(h.close) - 30;
}

/**
 * Up to `count` callback options from `now`: the next office-hours slots at least
 * one hour ahead, rounded to the hour, spread over different days when possible.
 */
export function nextCallbackOptions(now: Date, count = 3): Array<{ ymd: string; hhmm: string; label: string }> {
  const out: Array<{ ymd: string; hhmm: string; label: string }> = [];
  const today = israelParts(now);
  const preferred = ["10:00", "12:00", "16:00", "13:00"];
  for (let i = 0; i < 10 && out.length < count; i++) {
    const ymd = addDaysYmd(today.ymd, i);
    const candidates = preferred.filter((t) => isWithinOfficeHours(ymd, t));
    const slot = candidates.find((t) => israelInstant(ymd, t).getTime() - now.getTime() >= 60 * 60 * 1000);
    if (slot) out.push({ ymd, hhmm: slot, label: `${heDayLabel(ymd)} ב-${slot}` });
  }
  return out;
}

/** Default follow-up: two days from now at 10:00 Israel time. */
export function defaultFollowUp(now: Date = new Date()): Date {
  return israelInstant(addDaysYmd(israelYmd(now), 2), "10:00");
}

/** The office is open now (Israel time): Sun–Thu 09:00–17:00, Fri 09:00–14:00 (close time exclusive). */
export function isOfficeOpenAt(d: Date): boolean {
  const p = israelParts(d);
  const h = officeHoursFor(p.weekday);
  return !!h && p.hhmm >= h.open && p.hhmm < h.close;
}

/** "בהקדם" while the office is open. */
export const CALLBACK_SOON = "בהקדם";

/**
 * When a rep calls back, in words (Or, item 34). One rule for the website-form template and
 * every bot closing, computed at the moment the message is SENT:
 *   office open                      → "בהקדם"
 *   Sun–Fri before 09:00             → "היום בבוקר"
 *   Sun–Thu after closing            → "מחר בבוקר"   (Thursday too: Friday is a work day)
 *   Fri after 14:00 / all of Saturday → "ביום ראשון בבוקר"
 * Israel time via Intl, so daylight-saving changes are handled. Holidays: not in this phase.
 */
export function nextCallbackPhrase(d: Date = new Date()): string {
  if (isOfficeOpenAt(d)) return CALLBACK_SOON;
  const p = israelParts(d);
  const h = officeHoursFor(p.weekday);
  if (!h) return "ביום ראשון בבוקר"; // Saturday
  if (p.hhmm < h.open) return "היום בבוקר";
  return p.weekday === 5 ? "ביום ראשון בבוקר" : "מחר בבוקר";
}
