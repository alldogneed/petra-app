/**
 * Canonical automation-rule trigger keys.
 *
 * SINGLE SOURCE OF TRUTH for what `AutomationRule.trigger` may contain.
 * These are the LOWERCASE keys used everywhere in the app:
 *   - UI: AUTOMATION_TRIGGERS / STARTER_TEMPLATES in messages-panel.tsx
 *   - Crons: birthday-reminders queries `trigger: "birthday_reminder"`
 *   - reminder-service.ts: appointment_reminder / appointment_followup / boarding_pickup / service_dog_meeting_reminder
 *   - appointments/orders routes: appointment_confirmation
 *
 * The API validation MUST match these — a previous uppercase list
 * ("BIRTHDAY", "AFTER_APPOINTMENT", …) silently rejected every real rule,
 * breaking automation activation from the messages panel.
 */
export const VALID_AUTOMATION_TRIGGERS = [
  "appointment_confirmation",
  "appointment_reminder",
  "appointment_followup",
  "payment_request",
  "lead_followup",
  "birthday_reminder",
  "boarding_pickup",
  "new_customer",
  "service_dog_meeting_reminder",
] as const;

export type AutomationTrigger = (typeof VALID_AUTOMATION_TRIGGERS)[number];

export function isValidAutomationTrigger(value: unknown): value is AutomationTrigger {
  return typeof value === "string" && (VALID_AUTOMATION_TRIGGERS as readonly string[]).includes(value);
}
