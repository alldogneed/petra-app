/**
 * Prefill for "רישום מפגש" (client-safe, pure).
 *
 * Logging meeting N completes the SCHEDULED row with that number (createProgramSession
 * updates it in place) — and overwrites its date with what the form sends. The form used
 * to default to today + 10:00, so a meeting held on its scheduled day (e.g. 2/11 18:00)
 * was re-dated to the day it was logged (support, שחר אברמוביץ 11/11/2026). The form now
 * starts from the scheduled meeting's own date / time / duration.
 */
export interface SessionPrefill {
  sessionDate: string; // YYYY-MM-DD (browser-local, same as the edit form)
  sessionTime: string; // HH:mm
  durationMinutes: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function scheduledSessionPrefill(
  sessions: Array<{ sessionNumber: number | null; sessionDate: string; durationMinutes: number; status: string }> | undefined,
  sessionNumber: number
): SessionPrefill | null {
  const s = (sessions ?? []).find((x) => x.status === "SCHEDULED" && x.sessionNumber === sessionNumber);
  if (!s) return null;
  const d = new Date(s.sessionDate);
  if (isNaN(d.getTime())) return null;
  return {
    sessionDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    sessionTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    durationMinutes: s.durationMinutes || 60,
  };
}
