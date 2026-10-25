/**
 * AllDog item 34 — the bot's first WhatsApp to a lead who left details in a website form
 * (all-dog.co.il → /api/contact → Petra POST /api/webhooks/lead, source "אתר · …"). Pure rules.
 *
 * Queued with a random 3–5 min delay (never sent inside the request), sent by the per-minute
 * cron. Right before sending everything is checked again; the template (open / closed) and the
 * callback phrase are computed at the actual send time (`nextCallbackPhrase`).
 */
import { readEnv } from "@/lib/read-env";
import type { CallbackSlot } from "@/lib/alldog/time";
import { renderTemplateBody, type TemplateStep } from "@/lib/alldog/missed-call-rules";

export { FORM_LEAD_MESSAGE_KIND, FORM_LEAD_MESSAGE_LABEL } from "@/lib/alldog/missed-call-labels";

/** Approved Meta templates (Utility, he) — the bodies are copied word for word for the rep chat. */
export const FORM_LEAD_TEMPLATES = {
  open: {
    name: "lead_followup_open",
    body: "היי {{1}}, כאן צוות AllDog 🙂 קיבלנו את הפרטים שהשארתם באתר, ונציגה תחזור אליכם בהקדם. בינתיים, תוכלו לכתוב לי פה בקצרה מה קורה עם הכלב/ה שלכם, כדי שהיא תגיע לשיחה מוכנה?",
  },
  closed: {
    name: "lead_followup_closed",
    body: "היי {{1}}, כאן צוות AllDog 🙂 קיבלנו את הפרטים שהשארתם באתר, ונציגה תחזור אליכם {{2}}. בינתיים, תוכלו לכתוב לי פה בקצרה מה קורה עם הכלב/ה שלכם, כדי שהיא תגיע לשיחה מוכנה?",
  },
  weekend: {
    name: "lead_followup_weekend",
    body: "היי {{1}}, כאן צוות AllDog 🙂 קיבלנו את הפרטים שהשארתם באתר. אנחנו בחופשת סוף השבוע, ונציגה תחזור אליכם ביום ראשון בבוקר. בינתיים, תוכלו לכתוב לי פה בקצרה מה קורה עם הכלב/ה שלכם, כדי שהיא תגיע לשיחה מוכנה? שבת שלום 🙂",
  },
} as const;
export const FORM_LEAD_LANGUAGE = "he";

/** Queue rows (WaBotMessage role "system", no DDL) — one per lead (`waMessageId = form-lead:<leadId>`). */
export const FORM_LEAD_KINDS = {
  pending: "form_lead_pending",
  sending: "form_lead_sending",
  sent: "form_lead_sent",
  skipped: "form_lead_skipped",
  failed: "form_lead_failed",
} as const;

export const FORM_LEAD_DEDUP_MS = 24 * 60 * 60 * 1000;
export const FORM_LEAD_DELAY_MIN_MS = 3 * 60 * 1000;
export const FORM_LEAD_DELAY_MAX_MS = 5 * 60 * 1000;
/** A lead older than this when it is queued is never messaged (no backfill). */
export const FORM_LEAD_MAX_AGE_AT_SCHEDULE_MS = 30 * 60 * 1000;

export function isFormWaEnabled(): boolean {
  return readEnv("ALLDOG_FORM_WA_ENABLED")?.toLowerCase() === "true";
}
/** Activation time (ISO). Missing / unreadable → nothing is sent (fail closed). */
export function formWaActivatedAt(): Date | null {
  const raw = readEnv("ALLDOG_FORM_WA_SINCE");
  if (!raw) return null;
  const t = Date.parse(raw);
  return isNaN(t) ? null : new Date(t);
}

/** A lead from the website lead forms (not the floating WhatsApp button "וואטסאפ · …", not Make / manual). */
export function isWebsiteFormSource(source: string | null | undefined): boolean {
  return /^אתר(\s|·|$)/.test((source ?? "").trim());
}

/** Random 3–5 minutes after the lead (`rand` ∈ [0,1)). */
export function formLeadSendAt(leadCreatedAt: Date, rand: number = Math.random()): Date {
  const r = Math.min(Math.max(rand, 0), 0.999999);
  return new Date(leadCreatedAt.getTime() + FORM_LEAD_DELAY_MIN_MS + Math.floor(r * (FORM_LEAD_DELAY_MAX_MS - FORM_LEAD_DELAY_MIN_MS)));
}

/** First name for {{1}}: the first word of a real name (no phone numbers / placeholders); null → not sent. */
export function firstNameOf(name: string | null | undefined): string | null {
  const first = (name ?? "").replace(/\s+/g, " ").trim().split(" ")[0] ?? "";
  if (!first || /\d/.test(first) || first.length < 2 || /^(ליד|לקוח|ללא)$/.test(first)) return null;
  return first.slice(0, 30);
}

function step(t: { name: string; body: string }, params: string[]): TemplateStep {
  return { name: t.name, params, text: renderTemplateBody(t.body, params) };
}

/**
 * The form message for the callback slot at the ACTUAL send time (Or, 25/10), then the `open`
 * template as the fallback while a newer template is not approved yet. Pure — tested.
 */
export function formLeadSteps(firstName: string, slot: CallbackSlot): TemplateStep[] {
  const open = step(FORM_LEAD_TEMPLATES.open, [firstName]);
  if (slot.kind === "after_hours") return [step(FORM_LEAD_TEMPLATES.closed, [firstName, slot.phrase]), open];
  if (slot.kind === "weekend") return [step(FORM_LEAD_TEMPLATES.weekend, [firstName]), open];
  return [open];
}

export type FormLeadSkipReason =
  | "disabled"
  | "not_activated"
  | "not_form"
  | "lead_too_old"
  | "before_activation"
  | "not_mobile"
  | "no_name"
  | "existing_customer"
  | "returning_contact"
  | "active_conversation"
  | "stopped"
  | "missed_call_sent"
  | "sent_recently"
  | "customer_wrote"
  | "answered_call"
  | "lead_gone"
  | "lead_closed";

export const FORM_LEAD_SKIP_LABELS: Record<FormLeadSkipReason, string> = {
  disabled: "המתג כבוי",
  not_activated: "לא הוגדר זמן הפעלה (ALLDOG_FORM_WA_SINCE)",
  not_form: "הליד לא הגיע מטופס באתר",
  lead_too_old: "הליד ישן (לא שולחים לעבר)",
  before_activation: "הליד נוצר לפני ההפעלה",
  not_mobile: "לא מספר נייד ישראלי",
  no_name: "אין שם פרטי לתבנית",
  existing_customer: "המספר שייך ללקוח קיים",
  returning_contact: "פונה חוזר (יש ליד קודם עם המספר)",
  active_conversation: "יש שיחת בוט פעילה",
  stopped: "הלקוח ביקש להפסיק הודעות מהבוט",
  missed_call_sent: "נשלחה הודעת שיחה שלא נענתה ב-24 השעות האחרונות",
  sent_recently: "כבר נשלחה הודעה כזו למספר ב-24 השעות האחרונות",
  customer_wrote: "הלקוח כבר כתב לבוט בעצמו",
  answered_call: "כבר הייתה שיחת טלפון שנענתה",
  lead_gone: "הליד נמחק",
  lead_closed: "הליד כבר נסגר",
};

/** Lead-level rules at queue time. Pure — tested. */
export function scheduleSkipReason(input: {
  enabled: boolean;
  activatedAt: Date | null;
  source: string | null | undefined;
  leadCreatedAt: Date;
  now: Date;
}): FormLeadSkipReason | null {
  if (!input.enabled) return "disabled";
  if (!input.activatedAt) return "not_activated";
  if (!isWebsiteFormSource(input.source)) return "not_form";
  if (input.leadCreatedAt.getTime() < input.activatedAt.getTime()) return "before_activation";
  if (input.now.getTime() - input.leadCreatedAt.getTime() > FORM_LEAD_MAX_AGE_AT_SCHEDULE_MS) return "lead_too_old";
  return null;
}

/** Conversation-level rules (queue time AND send time). Pure — tested. */
export function conversationSkipReasonForForm(input: {
  conv: { status: string; lastInboundAt: Date | null } | null;
  leadCreatedAt: Date;
  lastMissedCallAt: Date | null;
  lastFormLeadAt: Date | null;
  now: Date;
}): FormLeadSkipReason | null {
  const { conv, now } = input;
  if (conv?.status === "stopped") return "stopped";
  if (conv?.status === "handoff") return "active_conversation";
  // The customer wrote to the bot after leaving the form → he is already talking to it.
  if (conv?.lastInboundAt && conv.lastInboundAt.getTime() >= input.leadCreatedAt.getTime() - 60_000) return "customer_wrote";
  if (conv?.lastInboundAt && now.getTime() - conv.lastInboundAt.getTime() < 24 * 60 * 60 * 1000) return "active_conversation";
  if (input.lastMissedCallAt && now.getTime() - input.lastMissedCallAt.getTime() < FORM_LEAD_DEDUP_MS) return "missed_call_sent";
  if (input.lastFormLeadAt && now.getTime() - input.lastFormLeadAt.getTime() < FORM_LEAD_DEDUP_MS) return "sent_recently";
  return null;
}

/**
 * A CallLog that means a person already talked with the lead: an answered PayCall call, or a call a
 * rep logged by hand. Automatic lines ("[וואטסאפ…", "[paycall] …" missed calls) do not count.
 */
export function isAnsweredCallLog(log: { type: string; summary: string }): boolean {
  if (log.type !== "call") return false;
  const s = log.summary.trimStart();
  if (s.includes("[paycall-answered]")) return true; // answered (even while its summary is pending)
  return !s.startsWith("[");
}

/** Context for the bot when the customer answers the form message: what the form already told us. */
export function formLeadContextNote(known: { name?: string | null; city?: string | null; service?: string | null }): string {
  const facts = [
    known.name ? `שם: ${known.name}` : null,
    known.city ? `עיר: ${known.city}` : null,
    known.service ? `שירות שבחר: ${known.service}` : null,
  ].filter(Boolean);
  return [
    "הלקוח השאיר פרטים בטופס באתר וקיבל מאיתנו הודעת וואטסאפ אוטומטית (\"קיבלנו את הפרטים… נציגה תחזור אליכם\"), ועכשיו הוא עונה לה.",
    facts.length ? `ידוע מהטופס: ${facts.join(" · ")}. אל תשאל על אלה שוב.` : null,
    "בלי הודעת פתיחה. מגיבים למה שכתב וממשיכים משם הכלב, גיל, גזע ומה הבעיה.",
  ].filter(Boolean).join(" ");
}
