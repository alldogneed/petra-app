/**
 * AllDog voice agent — the customer's WhatsApp messages for a phone sales call.
 * The templates are business-neutral (petra_sales_call_*); the values come from AllDog's
 * settings (voiceAgentSettings: business name, rep name, callback phone), never hardcoded here.
 * Sent from the Petra platform number, templates only (templateOnly) — the caller never wrote to us.
 */
import { voiceAgentSettings } from "@/lib/alldog/config";
import { isPlaceholderLeadName } from "@/lib/alldog/leads";
import { heDayLabel } from "@/lib/alldog/time";
import { spokenSlotLabel } from "@/lib/alldog/voice-agent/slots";
import {
  salesCallConfirmationChain,
  salesCallReminderChain,
  type SalesCallMessageInput,
} from "@/lib/reminder-service";
import type { TemplateStep } from "@/lib/whatsapp-template-chain";

export const SALES_CALL_CONFIRMATION_FLOW = "sales_call_confirmation";
export const SALES_CALL_REMINDER_FLOW = "sales_call_reminder";
/** ScheduledMessage.relatedEntityType of the confirmation log row (one per meeting). */
export const SALES_CALL_CONFIRMATION_ENTITY = "SALES_CALL_CONFIRMATION";

/** First name for the older appointment templates only; "" (step dropped) for a placeholder name. */
export function firstNameForMessage(name: string | null | undefined): string {
  const t = (name ?? "").trim();
  if (!t || isPlaceholderLeadName(t) || /^שיחה (קולית|מ-)/.test(t)) return "";
  return t.split(/\s+/)[0];
}

/** Template values for a sales call at ymd / hhmm (Israel), "when" spoken relative to `at` (the send time). */
export function salesCallInput(ymd: string, hhmm: string, leadName: string | null | undefined, at: Date): SalesCallMessageInput {
  const s = voiceAgentSettings();
  return {
    businessName: s.businessDisplayName,
    repName: s.salesRepName,
    customerName: firstNameForMessage(leadName),
    date: heDayLabel(ymd),
    time: hhmm,
    when: spokenSlotLabel(ymd, hhmm, at),
    phone: s.callbackPhone,
  };
}

export interface SalesCallMessage { templateChain: TemplateStep[]; body: string }

/** Confirmation right after booking. `body` is kept for the record / preview only (never sent: templateOnly). */
export function salesCallConfirmationMessage(ymd: string, hhmm: string, leadName: string | null | undefined, now: Date): SalesCallMessage {
  const p = salesCallInput(ymd, hhmm, leadName, now);
  return {
    templateChain: salesCallConfirmationChain(p),
    body: `שלום, תודה שפנית ל-${p.businessName}. קבענו לך שיחה טלפונית עם ${p.repName} מהצוות שלנו ל${p.date} בשעה ${p.time}. השיחה תהיה למספר הזה. אם צריך לשנות את המועד, אפשר להשיב להודעה הזו או להתקשר ל-${p.phone}. נשמח לעזור!`,
  };
}

/** Reminder 2 hours before (the reminder service calls this for sales-call meetings). */
export function salesCallReminderMessage(
  m: { date: Date; startTime: string; leadName: string | null | undefined },
  sendAt: Date
): SalesCallMessage {
  const ymd = m.date.toISOString().slice(0, 10);
  const p = salesCallInput(ymd, m.startTime, m.leadName, sendAt);
  return {
    templateChain: salesCallReminderChain(p),
    body: `שלום, תזכורת מ-${p.businessName}: ${p.when} מתקיימת השיחה הטלפונית שקבענו עם ${p.repName}. אם הזמן כבר לא מתאים, אפשר להשיב להודעה הזו או להתקשר ל-${p.phone}. נשמח לעזור!`,
  };
}
