/**
 * The phone customers see in automatic messages (reminders, confirmations, follow-ups) — item 40.4.
 * `Business.customerContactPhone` (Settings → פרטי העסק) wins; empty → `Business.phone` as before.
 * `Business.phone` stays the owner's number for alerts (lead alerts go there). Client-safe.
 */
export function customerContactPhoneOf(b: { phone?: string | null; customerContactPhone?: string | null } | null | undefined): string | null {
  return b?.customerContactPhone?.trim() || b?.phone?.trim() || null;
}

/** The meeting type in a reminder when the appointment / lead meeting has no service (was "פגישת היכרות"). */
export const DEFAULT_MEETING_LABEL = "הפגישה שלנו";
