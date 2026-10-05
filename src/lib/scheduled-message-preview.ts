/**
 * Human-readable view of a ScheduledMessage row — what the customer actually received.
 * Template messages keep only name + params in the DB; the approved text lives at Meta,
 * so it is fetched (cached) from the platform WABA and filled with the params here.
 */

import type { TemplateStep } from "@/lib/whatsapp-template-chain";

/** WhatsAppMessageLog.context / payload.flow / templateKey → short Hebrew label. */
const FLOW_LABELS: Record<string, string> = {
  appointment_confirmation: "אישור תור",
  appointment_confirmation_log: "אישור תור",
  appointment_reminder: "תזכורת לתור",
  appointment_followup: "מעקב אחרי תור",
  lead_followup: "מעקב ליד",
  boarding_checkout: "צ׳ק-אאוט פנסיון",
  boarding_thank_you: "תודה אחרי פנסיון",
  group_session_reminder: "תזכורת לשיעור קבוצתי",
  training_session_reminder: "תזכורת לאימון",
  service_dog_meeting_reminder: "תזכורת לפגישת כלב שירות",
  order_reminder: "תזכורת להזמנה",
};

export function messageLabel(templateKey: string, flow?: string | null): string {
  return (flow && FLOW_LABELS[flow]) || FLOW_LABELS[templateKey] || templateKey;
}

/** Replace {{1}}..{{n}} with params (1-based). Unknown positions are left as-is. */
export function renderTemplateText(text: string, params: string[]): string {
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, n) => params[Number(n) - 1] ?? match);
}

export interface MessagePreview {
  /** custom = free text written/stored by Petra · template = approved Meta template · unavailable = template known, text not */
  source: "custom" | "template" | "unavailable" | "none";
  label: string;
  text: string | null;
  footer: string | null;
  templateName: string | null;
  /** True when the params were rebuilt from the appointment (old log rows kept none). */
  reconstructed: boolean;
}

export function firstStep(steps: TemplateStep[], texts: Map<string, { body: string; footer: string | null }>): {
  step: TemplateStep;
  body: string;
  footer: string | null;
} | null {
  for (const step of steps) {
    const t = texts.get(step.name);
    if (t) return { step, body: renderTemplateText(t.body, step.params), footer: t.footer };
  }
  return null;
}

/**
 * payloadJson for the "appointment_confirmation_log" row: records what actually went out
 * (approved template + params, or the free text) so the messages page can show it.
 */
export function confirmationLogPayload(
  steps: TemplateStep[],
  fallbackBody: string,
  result: { success: boolean; via?: "template" | "text"; templateName?: string; error?: string } | null
): string {
  const sent = result?.success ? result : null;
  const payload: Record<string, unknown> = { flow: "appointment_confirmation" };
  if (sent?.via === "template") {
    payload.templateChain = steps.filter((s) => s.name === sent.templateName);
  } else if (sent?.via === "text") {
    payload.body = fallbackBody;
  } else {
    // nothing went out (or the send threw) — keep the intended message for the record
    payload.templateChain = steps;
    payload.body = fallbackBody;
  }
  return JSON.stringify(payload);
}
