/**
 * AllDog automations — immediate failure alerts to Or (item 31).
 *
 * Every failure that could leave a customer without an answer, or a call without a summary,
 * sends ONE WhatsApp + email through the existing owner alert (`notifyOwnerAllDog`,
 * template `petra_alldog_owner_alert`): what failed, a short reason, the customer's last 4
 * digits and a link to the lead. At most one alert per kind per 30 minutes (`claimOnce`).
 * Never throws. Never puts a token, a key or a full phone number in the alert.
 */
import { claimOnce } from "@/lib/rate-limit";
import { allDogBusinessId } from "@/lib/alldog/config";

export type AllDogFailureKind = "bot_reply" | "wa_send" | "transcription" | "webhook" | "call_summary" | "bot_summary";

export const FAILURE_KIND_TITLES: Record<AllDogFailureKind, string> = {
  bot_reply: "הבוט לא הצליח לענות ללקוח",
  wa_send: "שליחת הודעה בוואטסאפ נכשלה",
  transcription: "תמלול נכשל",
  webhook: "ה-webhook של וואטסאפ דחה הודעות או נכשל",
  call_summary: "שיחת PayCall נשארה בלי סיכום",
  bot_summary: "סיכום שיחת הבוט בוואטסאפ נכשל",
};

/** One alert per kind per 30 minutes. */
export const FAILURE_ALERT_THROTTLE_SECONDS = 30 * 60;

function appUrl(): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://petra-app.com").trim().replace(/\/$/, "");
}

/** Removes anything that looks like a secret before an error text reaches an alert. */
export function scrubSecrets(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer ***")
    .replace(/sk-ant-[A-Za-z0-9_\-]+/g, "sk-ant-***")
    .replace(/\b(?:EAA|xi-|sk_)[A-Za-z0-9_\-]{10,}/g, "***")
    .replace(/[A-Za-z0-9_\-]{32,}/g, "***")
    .replace(/\+?\d[\d\-\s]{7,}\d/g, (m) => `…${m.replace(/\D/g, "").slice(-4)}`);
}

/** Short Hebrew reason for an error from Claude / Meta / ElevenLabs. Pure — tested. */
export function explainFailure(err: unknown): string {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : typeof err === "string" ? err : JSON.stringify(err ?? "");
  const t = raw.toLowerCase();
  // Anthropic (Claude)
  if (/credit balance|billing|insufficient.?credit|payment required/.test(t)) return "נגמר הקרדיט ב-Anthropic (Claude)";
  if (/could not resolve authentication|apikey.*(?:missing|not set)|anthropic_api_key/.test(t)) return "מפתח Anthropic חסר";
  if (/invalid x-api-key|authentication_error|invalid api key|401/.test(t) && /anthropic|x-api-key|authentication_error/.test(t)) return "מפתח Anthropic לא תקין";
  if (/overloaded|529/.test(t)) return "השרת של Claude עמוס (overloaded)";
  if (/rate.?limit|429|too many requests/.test(t)) return "חריגה ממגבלת הקצב (rate limit)";
  // ElevenLabs
  if (/quota|character.?limit|exceeded your|insufficient.?quota/.test(t)) return "נגמרה המכסה ב-ElevenLabs";
  if (/elevenlabs/.test(t) && /401|unauthor|invalid/.test(t)) return "מפתח ElevenLabs לא תקין";
  // Meta WhatsApp
  if (/\b190\b|access token|session has expired|oauthexception/.test(t)) return "הטוקן של Meta פג או לא תקין";
  if (/131047|re-engagement|24.?hour/.test(t)) return "מחוץ לחלון 24 השעות של וואטסאפ";
  if (/131026|undeliverable|not a valid whatsapp/.test(t)) return "המספר לא זמין בוואטסאפ";
  if (/131031|account.*(locked|restricted)|blocked/.test(t)) return "המספר או החשבון חסום ב-Meta";
  if (/not_configured/.test(t)) return "חסרים משתני סביבה (token / phone number id)";
  // Generic
  if (/signature/.test(t)) return "חתימה לא תקינה";
  if (/timeout|timed out|aborterror|etimedout/.test(t)) return "פסק זמן (timeout)";
  if (/econnrefused|enotfound|fetch failed|network/.test(t)) return "שגיאת רשת";
  const short = scrubSecrets(raw).replace(/\s+/g, " ").trim().slice(0, 140);
  return short || "שגיאה לא ידועה";
}

/** "…1234" — the customer's last 4 digits only. */
export function last4(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 4 ? `…${d.slice(-4)}` : null;
}

export interface FailureAlertInput {
  kind: AllDogFailureKind;
  /** Error object or text — turned into a short reason with explainFailure(). */
  error?: unknown;
  /** Extra short detail (e.g. "call_id 12345"). Never a token or a full phone number. */
  detail?: string | null;
  phone?: string | null;
  leadId?: string | null;
  test?: boolean;
}

/** The alert text (title + lines + url). Pure — tested. */
export function buildFailureAlert(p: FailureAlertInput): { title: string; lines: string[]; url: string } {
  const who = last4(p.phone);
  const lines = [
    who ? `לקוח: ${who}` : "לקוח: לא ידוע",
    `סיבה: ${p.error === undefined ? "לא צוינה" : explainFailure(p.error)}`,
    p.detail ? scrubSecrets(p.detail).slice(0, 200) : null,
  ].filter((l): l is string => !!l);
  return {
    title: `${p.test ? "🧪 בדיקה: " : ""}${FAILURE_KIND_TITLES[p.kind]}`,
    lines,
    url: p.leadId ? `${appUrl()}/leads?lead=${p.leadId}` : `${appUrl()}/leads`,
  };
}

/**
 * Alert Or. Returns true when an alert went out (false = throttled / failed). Never throws.
 * The lead is looked up by phone when no leadId is given.
 */
export async function alertAllDogFailure(p: FailureAlertInput): Promise<boolean> {
  try {
    const key = p.test ? `alldog-failure-test:${p.kind}` : `alldog-failure:${p.kind}`;
    if (!(await claimOnce(key, p.test ? 60 : FAILURE_ALERT_THROTTLE_SECONDS))) return false;
    let leadId = p.leadId ?? null;
    const businessId = allDogBusinessId();
    if (!leadId && p.phone && businessId) {
      const { findLeadByPhone } = await import("@/lib/alldog/leads");
      leadId = (await findLeadByPhone(businessId, p.phone).catch(() => null))?.id ?? null;
    }
    const alert = buildFailureAlert({ ...p, leadId });
    const { notifyOwnerAllDog } = await import("@/lib/notify-owner");
    await notifyOwnerAllDog(alert);
    console.warn(`[alldog-failure] alert sent: ${p.kind}${p.test ? " (test)" : ""}`);
    return true;
  } catch (err) {
    console.error("[alldog-failure] alert failed:", err instanceof Error ? err.message : "error");
    return false;
  }
}
