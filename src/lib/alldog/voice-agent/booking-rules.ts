/**
 * AllDog voice agent — booking rules (pure — no DB).
 * Used by POST /api/webhooks/alldog-voice/book and /details (src/lib/alldog/voice-agent/booking.ts).
 */
import type { LeadPetDetails } from "@/lib/lead-pet-notes";
import { israelInstant, israelParts } from "@/lib/alldog/time";
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
export const VOICE_LOG_PREFIX = "[שיחה קולית · אלירן]";
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
