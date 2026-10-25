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

/** When a rep calls back, in words — `callbackPhraseFor(callbackSlot(d))` (Or, 25/10). */
export function nextCallbackPhrase(d: Date = new Date()): string {
  return callbackPhraseFor(callbackSlot(d));
}

// ─── Item 34 (Or, 25/10): one callback slot for both automatic messages + every bot closing ──

/** Tel Aviv (Hebcal's coordinates). */
const TLV = { lat: 32.08088, lng: 34.78057 };
/** Shabbat ends at tzeit 8.5° (the common Israeli calendars / Hebcal `tzeit(8.5)`). */
const SHABBAT_END_DEPRESSION = 8.5;

/**
 * When the sun is `depression`° below the horizon in the evening of `ymd` at Tel Aviv — NOAA solar
 * algorithm, accurate to about a minute (checked against Hebcal in the tests). Pure, no dependency.
 */
export function eveningDepressionTime(ymd: string, depression: number = SHABBAT_END_DEPRESSION): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const rad = Math.PI / 180;
  // Julian century at noon UTC of the day.
  const jd = Date.UTC(y, m - 1, d, 12) / 86400000 + 2440587.5;
  const t = (jd - 2451545) / 36525;
  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const mAnom = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const c =
    Math.sin(mAnom * rad) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * mAnom * rad) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * mAnom * rad) * 0.000289;
  const trueLong = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(omega * rad);
  const obliq0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliq = obliq0 + 0.00256 * Math.cos(omega * rad);
  const decl = Math.asin(Math.sin(obliq * rad) * Math.sin(appLong * rad)) / rad;
  const yv = Math.tan((obliq / 2) * rad) ** 2;
  const eqTime =
    4 / rad *
    (yv * Math.sin(2 * l0 * rad) -
      2 * e * Math.sin(mAnom * rad) +
      4 * e * yv * Math.sin(mAnom * rad) * Math.cos(2 * l0 * rad) -
      0.5 * yv * yv * Math.sin(4 * l0 * rad) -
      1.25 * e * e * Math.sin(2 * mAnom * rad));
  const zenith = 90 + depression;
  const cosHa =
    Math.cos(zenith * rad) / (Math.cos(TLV.lat * rad) * Math.cos(decl * rad)) - Math.tan(TLV.lat * rad) * Math.tan(decl * rad);
  const ha = Math.acos(Math.min(1, Math.max(-1, cosHa))) / rad;
  const minutesUtc = 720 - 4 * (TLV.lng - ha) - eqTime; // evening = solar noon + hour angle
  return new Date(Date.UTC(y, m - 1, d) + Math.round(minutesUtc * 60) * 1000);
}

/** Saturday's Shabbat end (Tel Aviv) for the Israel date `ymd`. */
export function shabbatEndsAt(ymd: string): Date {
  return eveningDepressionTime(ymd);
}

export type CallbackSlot =
  | { kind: "open" }
  | { kind: "after_hours"; phrase: "היום בבוקר" | "מחר בבוקר" }
  | { kind: "weekend" };

/**
 * The callback slot at `d` (Asia/Jerusalem) — Or, 25/10 (items 32 + 34 + every bot closing):
 *   open        Sun–Thu 09:00–17:00, Fri 09:00–14:00
 *   after_hours a weekday before 09:00 → "היום בבוקר"; Sun–Thu after 17:00 → "מחר בבוקר";
 *               Saturday night after Shabbat ends → "מחר בבוקר"
 *   weekend     Friday from 14:00 until Shabbat ends (tzeit 8.5°, Tel Aviv)
 */
export function callbackSlot(d: Date = new Date()): CallbackSlot {
  const p = israelParts(d);
  const h = officeHoursFor(p.weekday);
  if (p.weekday === 6) return d.getTime() >= shabbatEndsAt(p.ymd).getTime() ? { kind: "after_hours", phrase: "מחר בבוקר" } : { kind: "weekend" };
  if (!h) return { kind: "weekend" };
  if (p.hhmm < h.open) return { kind: "after_hours", phrase: "היום בבוקר" };
  if (p.hhmm < h.close) return { kind: "open" };
  return p.weekday === 5 ? { kind: "weekend" } : { kind: "after_hours", phrase: "מחר בבוקר" };
}

/** The slot in words: "בהקדם" / "היום בבוקר" / "מחר בבוקר" / "ביום ראשון בבוקר". */
export function callbackPhraseFor(slot: CallbackSlot): string {
  return slot.kind === "open" ? CALLBACK_SOON : slot.kind === "after_hours" ? slot.phrase : "ביום ראשון בבוקר";
}
