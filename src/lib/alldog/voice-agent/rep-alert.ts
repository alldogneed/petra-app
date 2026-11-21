/**
 * AllDog voice agent — the sales rep's alert for a call Eliran took (Or, 21/11/2026):
 * a bell in Petra (ALLDOG_SALES_REP_USER_ID, active member only) AND a WhatsApp to her mobile
 * (ALLDOG_SALES_REP_PHONE, templates only — she may not have written to the platform number).
 *
 *   regular call → ONE alert, with the summary line, when the summary is ready (kind "summary");
 *   urgent call  → an alert at once when save_details reports it, or the moment the summary finds
 *                  it (kind "urgent"), and the summary alert as well.
 * Each kind goes out once per conversation (claimOnce). Never throws.
 */
import prisma from "@/lib/prisma";
import { claimOnce } from "@/lib/rate-limit";
import { toWhatsAppPhone } from "@/lib/utils";
import { sendWithTemplateChain } from "@/lib/whatsapp-template-chain";
import { voiceAgentSettings } from "@/lib/alldog/config";
import { appUrl } from "@/lib/alldog/leads";

export const REP_ALERT_CONTEXT = "voice_rep_alert";
const WEEK_SECONDS = 7 * 24 * 60 * 60;

export interface RepAlert {
  businessId: string;
  conversationId: string;
  kind: "urgent" | "summary";
  /** Null for a caller with a hidden number who left none (no lead). */
  leadId: string | null;
  /** The caller's name, or the phone when no name is known. */
  displayName: string;
  phone: string | null;
  urgent: boolean;
  /** One line: what the call was about (the summary line, or the urgent reason). */
  line: string | null;
  /** "היום עד 10:19" — when the caller was promised a call back. */
  dueLabel: string | null;
}

const oneLine = (v: string) => v.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();

/** Title + the lines of the alert. Pure — tested. */
export function repAlertText(a: RepAlert): { title: string; who: string; details: string } {
  const title = `${a.urgent ? "דחוף: " : ""}שיחת טלפון עם אלירן · ${a.displayName}`;
  const who = a.phone ? (a.displayName === a.phone ? a.phone : `${a.displayName} · ${a.phone}`) : `${a.displayName} · מספר חסוי, לא השאיר מספר`;
  const details = [a.line ? oneLine(a.line) : "הסיכום עוד לא מוכן", a.dueLabel ? `לחזור: ${a.dueLabel}` : null].filter(Boolean).join(" · ");
  return { title: oneLine(title).slice(0, 120), who: oneLine(who).slice(0, 200), details: details.slice(0, 600) };
}

/** {{2}} of petra_voice_call_alert: the call's subject, opening with "דחוף:" for an urgent call. Pure — tested. */
export function voiceCallSubject(a: RepAlert): string {
  const line = a.line ? oneLine(a.line) : "הסיכום עוד לא מוכן";
  return `${a.urgent ? "דחוף: " : ""}${line}`.slice(0, 500);
}

async function bell(a: RepAlert, t: ReturnType<typeof repAlertText>): Promise<void> {
  const { salesRepUserId } = voiceAgentSettings();
  if (!salesRepUserId) return;
  const member = await prisma.businessUser.findFirst({
    where: { businessId: a.businessId, userId: salesRepUserId, isActive: true },
    select: { id: true },
  });
  if (!member) {
    console.warn("[alldog-voice rep-alert] ALLDOG_SALES_REP_USER_ID is not an active member of the business — no bell");
    return;
  }
  await prisma.notification.create({
    data: {
      userId: salesRepUserId,
      title: t.title,
      message: [t.who, t.details].join(" · ").slice(0, 900),
      actionUrl: a.leadId ? `/leads?lead=${a.leadId}` : "/leads",
    },
  });
}

async function whatsapp(a: RepAlert, t: ReturnType<typeof repAlertText>): Promise<void> {
  const { salesRepPhone } = voiceAgentSettings();
  const to = salesRepPhone ? toWhatsAppPhone(salesRepPhone) : null;
  if (!to) return;
  const url = a.leadId ? `${appUrl()}/leads?lead=${a.leadId}` : `${appUrl()}/leads`;
  const result = await sendWithTemplateChain({
    to,
    // The voice-call template first (its own UTILITY wording — petra_alldog_owner_alert was frequency-capped
    // by Meta, 131049); until Meta approves it the chain skips it. Then AllDog's alert template and the
    // approved "new lead" templates ([name, phone, service]).
    steps: [
      { name: "petra_voice_call_alert", params: [t.who, voiceCallSubject(a), a.dueLabel ?? "בהקדם", url] },
      { name: "petra_alldog_owner_alert", params: [t.title, t.who, t.details, url] },
      { name: "petra_lead_notification", params: [t.title, a.phone ?? "מספר חסוי", t.details.slice(0, 200)] },
      { name: "petra_biz_lead_alert", params: [t.title, a.phone ?? "מספר חסוי", t.details.slice(0, 200)] },
    ],
    fallbackBody: `${t.title}\n${t.who}\n${t.details}\n${url}`,
    businessId: a.businessId,
    context: REP_ALERT_CONTEXT,
    templateOnly: true,
  });
  if (!result.success) console.error(`[alldog-voice rep-alert] WhatsApp to the rep not sent — ${result.error ?? "unknown"}`);
}

/** Bell + WhatsApp, once per conversation and kind. Returns whether this call sent it. */
export async function alertSalesRep(a: RepAlert): Promise<boolean> {
  try {
    if (!(await claimOnce(`alldog-voice-rep:${a.kind}:${a.conversationId}`, WEEK_SECONDS))) return false;
    const t = repAlertText(a);
    const results = await Promise.allSettled([bell(a, t), whatsapp(a, t)]);
    results.forEach((r, i) => {
      if (r.status === "rejected") console.error(`[alldog-voice rep-alert] ${i === 0 ? "bell" : "whatsapp"} failed`, r.reason);
    });
    return true;
  } catch (err) {
    console.error("[alldog-voice rep-alert] failed", err);
    return false;
  }
}
