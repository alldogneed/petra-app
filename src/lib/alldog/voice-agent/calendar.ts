/**
 * AllDog voice agent — the sales call in Racheli's Google Calendar (write only).
 *
 * - booking: event in the rep's calendar ("Petra Bookings", popup 10 min before);
 * - move (updateLeadMeeting) / cancel (cancelLeadMeeting): only meetings that HAVE a calendar copy
 *   (GcalEventLink) are touched — every other LeadMeeting is a no-op after one lookup;
 * - never throws, never delays the booking (callers run it after the response);
 * - any failure (rep not connected / Google error / rep not configured) → an alert to Or, once a day.
 */
import { claimOnce } from "@/lib/rate-limit";
import { notifyOwnerAllDog } from "@/lib/notify-owner";
import { isAllDogBusiness, voiceAgentActiveFor, voiceAgentSettings } from "@/lib/alldog/config";
import { appUrl } from "@/lib/alldog/leads";
import {
  deleteLeadMeetingFromGcal,
  leadMeetingGcalUserIds,
  pushLeadMeetingToGcalForUser,
  type LeadMeetingGcalResult,
} from "@/lib/google-calendar";

const FAILURE_ALERT_KEY = "alldog-voice-gcal-failed";
const DAY_SECONDS = 24 * 60 * 60;

export type CalendarFailure = "rep_not_configured" | "not_connected" | "error";

/** Hebrew line for the daily alert. */
export function calendarFailureText(reason: CalendarFailure, error?: string): string {
  if (reason === "rep_not_configured") return "לא הוגדר חשבון הנציגה (ALLDOG_SALES_REP_USER_ID), לכן לא נכתב אירוע ליומן.";
  if (reason === "not_connected") return "הנציגה לא מחוברת ליומן גוגל בפטרה (או שאין לה הרשאת סנכרון יומן). צריך לחבר מחדש בהגדרות → אינטגרציות.";
  return `שגיאה מגוגל: ${(error ?? "לא ידוע").replace(/\s+/g, " ").slice(0, 200)}`;
}

async function alertFailureOncePerDay(reason: CalendarFailure, error?: string): Promise<void> {
  if (!(await claimOnce(FAILURE_ALERT_KEY, DAY_SECONDS))) return;
  const { salesRepName } = voiceAgentSettings();
  await notifyOwnerAllDog({
    title: `שיחת מכירה לא נכנסה ליומן הגוגל של ${salesRepName}`,
    lines: [calendarFailureText(reason, error), "השיחה נקבעה בפטרה כרגיל. ההתראה נשלחת פעם ביום."],
    url: `${appUrl()}/settings?tab=integrations`,
  });
}

function failureOf(r: LeadMeetingGcalResult): { reason: CalendarFailure; error?: string } | null {
  if (r.ok || r.reason === "meeting_not_found") return null;
  return { reason: r.reason, error: r.error };
}

/** Right after booking: the rep's calendar gets the event. */
export async function syncSalesCallToRepCalendar(businessId: string, meetingId: string): Promise<void> {
  try {
    if (!voiceAgentActiveFor(businessId)) return; // the /book route is already flag-gated; defence in depth
    const { salesRepUserId } = voiceAgentSettings();
    if (!salesRepUserId) {
      await alertFailureOncePerDay("rep_not_configured");
      return;
    }
    const failure = failureOf(await pushLeadMeetingToGcalForUser(meetingId, businessId, salesRepUserId));
    if (failure) {
      console.error(`[alldog-voice gcal] meeting ${meetingId}: ${failure.reason}${failure.error ? ` — ${failure.error}` : ""}`);
      await alertFailureOncePerDay(failure.reason, failure.error);
    }
  } catch (err) {
    console.error("[alldog-voice gcal] sync failed", err);
  }
}

/** The meeting was moved / edited in Petra → update the calendar copies it already has. */
export async function resyncSalesCallCalendar(businessId: string, meetingId: string): Promise<void> {
  try {
    // Any other business (or AllDog with the flag off): nothing, not even a lookup.
    if (!voiceAgentActiveFor(businessId)) return;
    const userIds = await leadMeetingGcalUserIds(meetingId);
    if (!userIds.length) return; // never synced (not a voice sales call) — nothing to do
    for (const userId of userIds) {
      const failure = failureOf(await pushLeadMeetingToGcalForUser(meetingId, businessId, userId));
      if (failure) {
        console.error(`[alldog-voice gcal] resync ${meetingId}: ${failure.reason}${failure.error ? ` — ${failure.error}` : ""}`);
        await alertFailureOncePerDay(failure.reason, failure.error);
      }
    }
  } catch (err) {
    console.error("[alldog-voice gcal] resync failed", err);
  }
}

/** The meeting was canceled → remove its calendar copies. */
export async function removeSalesCallFromCalendar(businessId: string, meetingId: string): Promise<void> {
  try {
    // AllDog only. Deliberately NOT gated by the flag: an event Petra already wrote to Racheli's
    // calendar is still removed when the call is canceled after the flag was turned off (cleanup only).
    if (!isAllDogBusiness(businessId)) return;
    if (!(await leadMeetingGcalUserIds(meetingId)).length) return;
    await deleteLeadMeetingFromGcal(meetingId, businessId);
  } catch (err) {
    console.error("[alldog-voice gcal] delete failed", err);
  }
}
