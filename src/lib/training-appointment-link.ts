/**
 * Training-package meeting ↔ calendar appointment (CLAUDE.md rule #45) — pure helpers.
 *
 * A TrainingProgramSession of an individual (HOME) program that belongs to a customer is
 * booked as a real calendar `Appointment` (`TrainingProgramSession.appointmentId`). The
 * appointment is the calendar entity: it owns the Google Calendar event and the customer
 * reminders; the session keeps the training content (summary, rating, homework).
 * One meeting = one calendar block, one gcal event, one reminder.
 *
 * Time model: `TrainingProgramSession.sessionDate` is an instant; `Appointment` is
 * `date` (UTC midnight of the local day) + local "HH:MM" start/end strings.
 */
import { localTimeToUtc } from "@/lib/slots";

export const DEFAULT_TIMEZONE = "Asia/Jerusalem";

/** Only individual programs with a customer are booked as appointments (boarding /
 *  service-dog programs are in-house work — no customer meeting, no customer reminder). */
export function isLinkableProgram(p: { trainingType?: string | null; customerId?: string | null }): boolean {
  return p.trainingType === "HOME" && !!p.customerId;
}

function localParts(instant: Date, tz: string): { ymd: string; hhmm: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { ymd: `${get("year")}-${get("month")}-${get("day")}`, hhmm: `${get("hour")}:${get("minute")}` };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Session instant + duration → appointment fields (end capped at 23:59 of the same day). */
export function sessionToAppointmentTimes(
  sessionDate: Date,
  durationMinutes: number | null | undefined,
  tz: string = DEFAULT_TIMEZONE
): { ymd: string; date: Date; startTime: string; endTime: string } {
  const { ymd, hhmm } = localParts(sessionDate, tz);
  const mins = durationMinutes && durationMinutes > 0 ? durationMinutes : 60;
  const start = toMinutes(hhmm);
  const end = Math.min(start + mins, 23 * 60 + 59);
  return {
    ymd,
    date: new Date(`${ymd}T00:00:00.000Z`),
    startTime: hhmm,
    endTime: fromMinutes(Math.max(end, start + 1)),
  };
}

/** Appointment date + local times → session instant + duration. */
export function appointmentToSessionTimes(
  date: Date | string,
  startTime: string,
  endTime: string,
  tz: string = DEFAULT_TIMEZONE
): { sessionDate: Date; durationMinutes: number } {
  const ymd = typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  const duration = toMinutes(endTime) - toMinutes(startTime);
  return {
    sessionDate: localTimeToUtc(startTime, ymd, tz),
    durationMinutes: duration > 0 ? duration : 60,
  };
}

/** Next free meeting number: the lowest number ≥1 not used by a live (non-canceled) session. */
export function nextSessionNumber(sessions: { sessionNumber: number | null; status: string }[]): number {
  const used = new Set(
    sessions.filter((s) => s.status !== "CANCELED" && s.sessionNumber).map((s) => s.sessionNumber as number)
  );
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

/** Notes line of the appointment that books meeting N of a program: "[אילוף] מפגש 3/6 · אילוף בסיסי". */
export function linkedAppointmentNotes(programName: string, sessionNumber: number | null, totalSessions: number | null): string {
  const num = sessionNumber ? ` ${sessionNumber}${totalSessions ? `/${totalSessions}` : ""}` : "";
  return `[אילוף] מפגש${num} · ${programName}`.slice(0, 500);
}
