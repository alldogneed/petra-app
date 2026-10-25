/** Client-safe constants of the bot's automatic template messages (used by the rep chat UI). */
export const MISSED_CALL_MESSAGE_KIND = "missed_call_template";
export const MISSED_CALL_MESSAGE_LABEL = "הודעה אוטומטית · שיחה שלא נענתה";
/** Item 34: the first message to a lead who left details in a website form. */
export const FORM_LEAD_MESSAGE_KIND = "form_lead_template";
export const FORM_LEAD_MESSAGE_LABEL = "הודעה אוטומטית · השאיר פרטים באתר";

/** Rep chat label of an automatic template message, or null for a normal bot message. */
export function autoMessageLabel(kind: string): string | null {
  if (kind === MISSED_CALL_MESSAGE_KIND) return MISSED_CALL_MESSAGE_LABEL;
  if (kind === FORM_LEAD_MESSAGE_KIND) return FORM_LEAD_MESSAGE_LABEL;
  return null;
}
