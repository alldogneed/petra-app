/**
 * AllDog voice agent — booking rules (pure — no DB).
 * Used by POST /api/webhooks/alldog-voice/book and /details (src/lib/alldog/voice-agent/booking.ts).
 */
import type { LeadPetDetails } from "@/lib/lead-pet-notes";
import { addDaysYmd, israelInstant, israelParts, israelYmd, weekdayOfYmd } from "@/lib/alldog/time";
import {
  SALES_CALL_MINUTES,
  SALES_WINDOWS,
  freeSlotsByWindow,
  salesWorkdays,
  spokenSlotLabel,
  type Interval,
  type SalesSlot,
} from "@/lib/alldog/voice-agent/slots";

/** Lead source of voice-agent leads (same "<channel> · <who>" pattern as the bot's "וואטסאפ · בוט"). */
export const VOICE_LEAD_SOURCE = "טלפון · סוכן קולי";
/** Racheli's stage after a sales call is booked — found by NAME, never created automatically. */
export const SALES_CALL_STAGE_NAME = "תואמה שיחת מכירה";
/** Prefix of the voice agent's lines in the lead journal. */
export const VOICE_LOG_PREFIX = "[שיחת טלפון · אלירן]";
/** Same task titles as the WhatsApp bot (src/lib/alldog-bot/actions.ts), so an open task from either channel counts. */
export const CALLBACK_TASK_PREFIX = "לחזור טלפונית";
export const URGENT_TITLE_PREFIX = "דחוף: ";
/** Single source: src/lib/lead-meetings.ts (the reminder service recognizes sales calls by it). */
export { SALES_CALL_LOCATION } from "@/lib/lead-meetings";
/** LeadMeeting.notes of a voice-agent sales call (the rep's name comes from voiceAgentSettings). */
export function salesCallNote(repName: string): string {
  return `שיחת מכירה טלפונית עם ${repName} · נקבעה ע"י אלירן (סוכן קולי)`;
}
/**
 * At booking time the minimum notice is 90 minutes (not the 2 hours of /start), so a slot offered
 * at the start of the call is still bookable a few minutes later when the caller picks it.
 */
export const BOOK_MIN_NOTICE_MS = 90 * 60 * 1000;
export const ALTERNATIVES_COUNT = 3;

export interface VoiceDetails {
  fullName?: string | null;
  dogName?: string | null;
  breed?: string | null;
  age?: string | null;
  city?: string | null;
  problem?: string | null;
  urgent?: boolean | null;
  urgentReason?: string | null;
  /** When the urgent incident happened, in the caller's words ("אתמול בערב"). */
  eventWhen?: string | null;
}

/** What Eliran promises: a rep calls back within about half an hour, during office hours. */
export const CALLBACK_WITHIN_MS = 30 * 60 * 1000;

/**
 * The sales rep's hours for that promise (Or, 21/11/2026, final): Sunday–Thursday 09:00–17:00;
 * Friday and Saturday off. On purpose NOT officeHoursFor() (src/lib/alldog/time.ts) — that is the
 * office rule of the WhatsApp bot and the automatic messages (Friday 09:00–14:00), which stays as it is.
 */
export const CALLBACK_WORKDAYS: readonly number[] = [0, 1, 2, 3, 4]; // Sunday–Thursday
export const CALLBACK_OPEN = "09:00";
export const CALLBACK_CLOSE = "17:00";
/** A call outside those hours is returned by this time on the next workday (opening + 30 minutes). */
export const CALLBACK_NEXT_DAY_BY = "09:30";
/** The last call that can still be returned the same day: 30 minutes before closing. */
export const CALLBACK_LAST_SAME_DAY = "16:30";

/** A call at this instant can be returned within 30 minutes, before closing (Israel time; 16:30 itself still can). */
export function canCallBackSameDay(d: Date): boolean {
  const p = israelParts(d);
  return CALLBACK_WORKDAYS.includes(p.weekday) && p.hhmm >= CALLBACK_OPEN && p.hhmm <= CALLBACK_LAST_SAME_DAY;
}

/**
 * The "לחזור טלפונית" task's target: 30 minutes after a call that came between 09:00 and 16:30 on
 * a workday (so the target is never after closing); any other call → the next workday at 09:30
 * (a call after 16:30 → the next morning; Thursday after 16:30, Friday or Saturday → Sunday 09:30;
 * a call before 09:00 on a workday → the same day 09:30). Holidays are not known here.
 * Pure — tested.
 */
export function callbackDueAt(callAt: Date): Date {
  if (canCallBackSameDay(callAt)) return new Date(callAt.getTime() + CALLBACK_WITHIN_MS);
  const today = israelYmd(callAt);
  for (let i = 0; i <= 8; i++) {
    const ymd = addDaysYmd(today, i);
    if (!CALLBACK_WORKDAYS.includes(weekdayOfYmd(ymd))) continue;
    if (israelInstant(ymd, CALLBACK_OPEN).getTime() > callAt.getTime()) return israelInstant(ymd, CALLBACK_NEXT_DAY_BY);
  }
  return new Date(callAt.getTime() + CALLBACK_WITHIN_MS);
}

/** "היום עד 10:19" / "יום ראשון 22/11 עד 09:30" — for the task and the rep's alert. Pure. */
export function callbackDueLabel(due: Date, now: Date): string {
  const d = israelParts(due);
  if (d.ymd === israelYmd(now)) return `היום עד ${d.hhmm}`;
  const [, m, day] = d.ymd.split("-");
  const names = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  return `יום ${names[d.weekday]} ${Number(day)}/${Number(m)} עד ${d.hhmm}`;
}

/**
 * The first name only — all the voice agent may say back to a caller recognized by number
 * (identification by caller id is not verification). Null for a placeholder / a name with digits.
 */
export function firstNameOf(name: string | null | undefined): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0]?.replace(/[^\p{L}'׳"״-]/gu, "") ?? "";
  return first.length >= 2 && first.length <= 30 ? first : null;
}

export type SlotCheck =
  | { ok: true; ymd: string; hhmm: string; endHhmm: string; start: Date; end: Date }
  | { ok: false; reason: "unparseable" | "off_grid" | "outside_windows" | "too_soon" | "too_far" };

function toMinutes(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

function fromMinutes(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * The slot the agent wants to book: a sales-window slot on the 20-minute grid, ≥ 90 min from now,
 * within the 5 workdays of /start. `startsAt` is the ISO instant /start returned.
 */
export function checkBookingSlot(startsAt: string, now: Date): SlotCheck {
  const start = new Date(startsAt);
  if (!startsAt || isNaN(start.getTime())) return { ok: false, reason: "unparseable" };
  const { ymd, hhmm } = israelParts(start);
  if (start.getUTCSeconds() !== 0 || start.getUTCMilliseconds() !== 0 || israelInstant(ymd, hhmm).getTime() !== start.getTime()) {
    return { ok: false, reason: "off_grid" };
  }
  if (!salesWorkdays(now).includes(ymd)) {
    return { ok: false, reason: start.getTime() < now.getTime() ? "too_soon" : "too_far" };
  }
  const m = toMinutes(hhmm);
  const window = SALES_WINDOWS.find((w) => m >= toMinutes(w.start) && m + SALES_CALL_MINUTES <= toMinutes(w.end));
  if (!window) return { ok: false, reason: "outside_windows" };
  if ((m - toMinutes(window.start)) % SALES_CALL_MINUTES !== 0) return { ok: false, reason: "off_grid" };
  if (start.getTime() < now.getTime() + BOOK_MIN_NOTICE_MS) return { ok: false, reason: "too_soon" };
  const endHhmm = fromMinutes(m + SALES_CALL_MINUTES);
  return { ok: true, ymd, hhmm, endHhmm, start, end: new Date(start.getTime() + SALES_CALL_MINUTES * 60 * 1000) };
}

/** The 3 free slots closest in time to the requested one (any window), in time order. */
export function nearestAlternatives(requested: Date | null, now: Date, busy: Interval[], count = ALTERNATIVES_COUNT): SalesSlot[] {
  const free = freeSlotsByWindow(now, busy, salesWorkdays(now), BOOK_MIN_NOTICE_MS).flat();
  const anchor = requested && !isNaN(requested.getTime()) ? requested.getTime() : now.getTime();
  return free
    .map((c) => ({ c, d: Math.abs(c.start.getTime() - anchor) }))
    .sort((a, b) => a.d - b.d || a.c.start.getTime() - b.c.start.getTime())
    .slice(0, count)
    .map((x) => x.c)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((c) => ({ ymd: c.ymd, hhmm: c.hhmm, startsAt: c.start.toISOString(), label: spokenSlotLabel(c.ymd, c.hhmm, now) }));
}

/**
 * Stage moves only forward: from an earlier open stage (by sortOrder) to the sales-call stage.
 * Already later, or won / lost → no change. A current stage not found in this business
 * (old leads may point at another business's stage) counts as earlier.
 */
export function shouldMoveToStage(
  current: { sortOrder: number; isWon: boolean; isLost: boolean } | null,
  target: { sortOrder: number }
): boolean {
  if (!current) return true;
  if (current.isWon || current.isLost) return false;
  return current.sortOrder < target.sortOrder;
}

function clean(v: string | null | undefined, max: number): string | null {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

/** Collected details → the lead's "פרטי הכלב" block (same mapping as the bot: the problem goes into its notes). */
export function petFromDetails(d: VoiceDetails): LeadPetDetails | null {
  const pet = {
    name: clean(d.dogName, 100),
    breed: clean(d.breed, 100),
    age: clean(d.age, 50),
    notes: clean(d.problem, 500),
  };
  return pet.name || pet.breed || pet.age || pet.notes ? pet : null;
}

/** VoiceAgentCall.salesBrief until the end-of-call summary (section 5) replaces it. */
export function salesBriefFromDetails(d: VoiceDetails): Record<string, string | boolean | null> {
  return {
    dog: clean(d.dogName, 100),
    breed: clean(d.breed, 100),
    age: clean(d.age, 50),
    city: clean(d.city, 200),
    problem: clean(d.problem, 500),
    urgency: d.urgent ? "high" : null,
    notes: d.urgent ? clean(d.urgentReason, 500) : null,
    eventWhen: clean(d.eventWhen, 150),
  };
}

export function cleanName(v: string | null | undefined): string | null {
  return clean(v, 100);
}

export function cleanCity(v: string | null | undefined): string | null {
  return clean(v, 200);
}

export function cleanReason(v: string | null | undefined): string | null {
  return clean(v, 500);
}
