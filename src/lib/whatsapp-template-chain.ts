/**
 * Ordered WhatsApp template chain for automated customer sends.
 *
 * Why: Meta silently frequency-caps MARKETING-category templates per recipient —
 * the API answers `accepted` and nothing is delivered. Several of the templates
 * hard-wired into reminder-service.ts are MARKETING, so reminders/follow-ups can
 * drop on the floor with no error. Swapping a name for a newer UTILITY one is not
 * safe either: if the new name is not approved on the WABA, Meta rejects it and
 * we fall to free text, which only works inside the 24h service window.
 *
 * So every automated flow carries an ORDERED CHAIN of template steps:
 *
 *     UTILITY template  →  legacy (MARKETING) template  →  free text (24h only)
 *
 * The send succeeds at the first step Meta accepts. A template that does not
 * exist / is not approved is rejected by Meta at send time and simply skipped,
 * so a flow never degrades below today's behaviour. Sender selection (business
 * number vs platform, template approval on the business WABA) stays inside
 * `sendWhatsAppTemplate` → `resolveWhatsAppSender()` and runs for every step.
 *
 * New UTILITY names go at the FRONT of a chain (see META_TEMPLATES in
 * reminder-service.ts) — never replace the older names.
 */

import { sendWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp";

export interface TemplateStep {
  name: string;      // approved Meta template name, e.g. "petra_lead_followup_notice"
  params: string[];  // positional body params {{1}}..{{n}}
}

export interface ChainSendInput {
  to: string;                  // WhatsApp-ready digits e.g. "972501234567"
  steps: TemplateStep[];       // tried in order; may be empty
  fallbackBody: string;        // free-text body sent when every template fails
  businessId: string | null;   // send on behalf of this business (own number when connected)
  context: string;             // WhatsAppMessageLog.context — the flow name, e.g. "lead_followup"
}

export interface FailedTemplate {
  name: string;
  error: string;
}

export interface ChainSendResult {
  success: boolean;
  messageSid?: string;
  error?: string;
  /** How the message finally went out (undefined when nothing succeeded). */
  via?: "template" | "text";
  /** Template name that succeeded (when via === "template"). */
  templateName?: string;
  /** Every template step that Meta rejected before the successful one, in order. */
  failedTemplates: FailedTemplate[];
}

/** Payload keys read by chainFromPayload. Kept loose — payloads are JSON blobs. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LoosePayload = Record<string, any> | null | undefined;

/**
 * Build a chain from candidate steps, dropping any step that has an empty
 * parameter — Meta rejects empty body parameters, so such a step can never
 * succeed and would only add a failed round-trip.
 */
export function buildTemplateChain(candidates: Array<{ name: string; params: Array<string | null | undefined> }>): TemplateStep[] {
  const out: TemplateStep[] = [];
  for (const c of candidates) {
    if (!c.name) continue;
    const params = c.params.map((p) => (p ?? "").toString().trim());
    if (params.some((p) => p.length === 0)) continue;
    out.push({ name: c.name, params });
  }
  return out;
}

/**
 * Read the template chain out of a ScheduledMessage payload.
 * New payloads carry `templateChain: [{ name, params }]`; rows queued before
 * this module shipped carry `metaTemplateName` + `metaTemplateParams` — both
 * shapes are honoured so nothing already waiting in the queue is lost.
 */
export function chainFromPayload(payload: LoosePayload): TemplateStep[] {
  if (!payload || typeof payload !== "object") return [];

  const raw = payload.templateChain;
  if (Array.isArray(raw) && raw.length > 0) {
    const steps: TemplateStep[] = [];
    for (const s of raw) {
      if (!s || typeof s !== "object" || typeof s.name !== "string" || !s.name) continue;
      const params = Array.isArray(s.params) ? s.params.map((p: unknown) => String(p ?? "")) : [];
      steps.push({ name: s.name, params });
    }
    return steps;
  }

  if (typeof payload.metaTemplateName === "string" && payload.metaTemplateName) {
    const params = Array.isArray(payload.metaTemplateParams)
      ? payload.metaTemplateParams.map((p: unknown) => String(p ?? ""))
      : [];
    return [{ name: payload.metaTemplateName, params }];
  }

  return [];
}

/**
 * Map a scheduled message to its WhatsAppMessageLog.context. Prefers the explicit
 * `flow` written into new payloads; legacy rows are mapped by relatedEntityType.
 */
export function contextForScheduledMessage(payload: LoosePayload, relatedEntityType: string | null | undefined): string {
  const flow = payload && typeof payload === "object" ? payload.flow : undefined;
  if (typeof flow === "string" && /^[a-z0-9_]+$/.test(flow)) return flow;

  switch (relatedEntityType) {
    case "APPOINTMENT": return "appointment_reminder";
    case "APPOINTMENT_FOLLOWUP": return "appointment_followup";
    case "LEAD_FOLLOWUP": return "lead_followup";
    case "BOARDING": return "boarding_checkout";
    case "BOARDING_THANKYOU": return "boarding_thank_you";
    case "GROUP_SESSION": return "group_session_reminder";
    case "TRAINING_SESSION": return "training_session_reminder";
    case "SERVICE_DOG_MEETING": return "service_dog_meeting_reminder";
    case "ORDER": return "order_reminder";
    default: return "scheduled_message";
  }
}

/**
 * Try each template step in order; on the first success return. Every rejected
 * template is logged WITH Meta's error so a mis-named / unapproved template is
 * visible in the cron logs. Only after every step fails does the free-text body
 * go out (24h window only). Never throws.
 */
export async function sendWithTemplateChain(input: ChainSendInput): Promise<ChainSendResult> {
  const { to, steps, fallbackBody, businessId, context } = input;
  const failedTemplates: FailedTemplate[] = [];

  for (const step of steps) {
    try {
      const res = await sendWhatsAppTemplate({
        to,
        templateName: step.name,
        bodyParams: step.params,
        businessId,
        context,
      });
      if (res.success) {
        return { success: true, messageSid: res.messageSid, via: "template", templateName: step.name, failedTemplates };
      }
      const error = res.error ?? "unknown error";
      failedTemplates.push({ name: step.name, error });
      console.warn(`[WhatsApp chain] ${context}: template "${step.name}" rejected — ${error}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      failedTemplates.push({ name: step.name, error });
      console.error(`[WhatsApp chain] ${context}: template "${step.name}" threw — ${error}`);
    }
  }

  if (steps.length > 0) {
    console.warn(
      `[WhatsApp chain] ${context}: all ${steps.length} template(s) failed (${failedTemplates.map((f) => f.name).join(", ")}) — sending free text (24h window only)`
    );
  }

  try {
    const res = await sendWhatsAppMessage({ to, body: fallbackBody, businessId, context });
    return {
      success: res.success,
      messageSid: res.messageSid,
      error: res.error,
      via: res.success ? "text" : undefined,
      failedTemplates,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[WhatsApp chain] ${context}: free-text send threw — ${error}`);
    return { success: false, error, failedTemplates };
  }
}
