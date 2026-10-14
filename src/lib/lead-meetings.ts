/**
 * Lead meetings — pure helpers (no DB). A meeting booked with a LEAD before it is a
 * customer: blocks online-booking slots, gets a WhatsApp reminder, and on "completed"
 * the lead becomes a customer. DB logic lives in src/services/lead-meetings.ts.
 */

export const LEAD_MEETING_STATUSES = ["scheduled", "completed", "no_show", "canceled"] as const;
export type LeadMeetingStatus = (typeof LEAD_MEETING_STATUSES)[number];

export const LEAD_MEETING_STATUS_LABELS: Record<LeadMeetingStatus, string> = {
  scheduled: "נקבעה",
  completed: "התקיימה",
  no_show: "לא הגיע",
  canceled: "בוטלה",
};

/** Outcomes the owner can record once the meeting time has arrived. */
export const LEAD_MEETING_OUTCOMES = ["completed", "no_show"] as const;
export type LeadMeetingOutcome = (typeof LEAD_MEETING_OUTCOMES)[number];

/** Default reminder lead time when the business has no lead_meeting_reminder rule. */
export const LEAD_MEETING_REMINDER_HOURS = 24;

/** Reminder relatedEntityType on ScheduledMessage. */
export const LEAD_MEETING_ENTITY = "LEAD_MEETING";

/** Notes tag on the completed Appointment created when a meeting converts the lead. */
export const LEAD_MEETING_APPOINTMENT_TAG = "[פגישת ליד]";

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidYmd(ymd: string): boolean {
  if (!YMD_RE.test(ymd)) return false;
  const d = new Date(`${ymd}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd;
}

/** Validation error message (Hebrew) or null when the slot is well-formed. */
export function validateMeetingSlot(input: { date: string; startTime: string; endTime: string }): string | null {
  if (!isValidYmd(input.date)) return "תאריך לא תקין";
  if (!HHMM_RE.test(input.startTime) || !HHMM_RE.test(input.endTime)) return "שעות חייבות להיות בפורמט HH:MM";
  if (input.startTime >= input.endTime) return "שעת ההתחלה חייבת להיות לפני שעת הסיום";
  return null;
}

/** "HH:mm" + minutes, clamped to 23:59 (meetings never cross midnight). */
export function addMinutesHHmm(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Which status transitions are allowed. A scheduled meeting can be completed, marked
 * no-show, or canceled; a closed meeting is final (a new meeting is booked instead).
 */
export function canTransition(from: string, to: LeadMeetingStatus): boolean {
  return from === "scheduled" && to !== "scheduled";
}

/** Outcome buttons appear once the meeting start time has passed (instant from israelDateTime). */
export function isMeetingDue(meetingStart: Date, now: Date = new Date()): boolean {
  return meetingStart.getTime() <= now.getTime();
}
