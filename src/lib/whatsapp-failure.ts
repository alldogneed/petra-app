/**
 * Why a WhatsApp message failed, in Hebrew, plus what to do about it — used by the
 * platform-owner alert (status webhook → notifyOwnerWhatsAppFailure). Pure, no DB.
 */

/** WhatsAppMessageLog.context → Hebrew name of the flow. */
export const WHATSAPP_CONTEXT_LABELS: Record<string, string> = {
  appointment_reminder: "תזכורת לתור",
  appointment_confirmation: "אישור תור",
  appointment_followup: "הודעת מעקב אחרי פגישה",
  training_session_reminder: "תזכורת למפגש אילוף",
  lead_followup: "מעקב ליד",
  lead_meeting_reminder: "תזכורת לפגישת ליד",
  boarding_checkout: "יציאה מפנסיון",
  boarding_thank_you: "תודה אחרי פנסיון",
  payment_request: "בקשת תשלום",
  customer_message: "הודעה ידנית מכרטיס לקוח",
  inbound_ack: "אישור קבלה לתשובת לקוח",
  booking_confirmation: "אישור הזמנה אונליין",
  booking_pending: "הזמנה אונליין ממתינה",
  booking_request_received: "בקשת הזמנה התקבלה",
  booking_approved: "הזמנה אושרה",
  booking_declined: "הזמנה נדחתה",
  scheduled_message: "הודעה מתוזמנת",
  vaccination_reminder: "תזכורת חיסון",
  pet_birthday: "יום הולדת לכלב",
  mcp_reminder: "תזכורת מעוזר AI",
  contract_send: "שליחת חוזה",
  contract_resend: "שליחת חוזה מחדש",
  boarding_confirmation: "אישור פנסיון",
  waitlist_promoted: "עלייה מרשימת המתנה",
  group_session_reminder: "תזכורת למפגש קבוצתי",
  service_dog_meeting_reminder: "תזכורת לפגישת כלב שירות",
  order_reminder: "תזכורת הזמנה",
  membership_approved: "אישור חברות בקורס",
  membership_expiry: "חברות בקורס עומדת לפוג",
  course_enrollment: "הרשמה לקורס",
  course_new_lessons: "שיעורים חדשים בקורס",
  course_nudge: "תזכורת להמשך קורס",
  online_class_zoom_link: "קישור לשיעור אונליין",
};

/** Messages to the business owner / the user themselves — a failure there is not a customer issue. */
const NON_CUSTOMER_CONTEXTS = new Set([
  "lead_alert",
  "security_alert",
  "booking_owner_alert",
  "contract_signed",
  "settings_test",
  "whatsapp_test",
  "test",
]);

export function isCustomerFacingContext(context: string | null | undefined): boolean {
  return !!context && !NON_CUSTOMER_CONTEXTS.has(context);
}

export function contextLabel(context: string | null | undefined): string {
  if (!context) return "הודעה";
  return WHATSAPP_CONTEXT_LABELS[context] ?? context;
}

export interface MetaError {
  code?: number | string | null;
  title?: string | null;
  message?: string | null;
  error_data?: { details?: string | null } | null;
}

export interface FailureExplanation {
  /** Short Hebrew reason */
  reason: string;
  /** What fixes it */
  fix: string;
  /** true = our side (missing template / setup); false = the recipient's side */
  actionable: boolean;
}

/**
 * Meta error codes seen in practice:
 * 131047 re-engagement (free text outside 24h) · 131026 undeliverable (no WhatsApp / blocked)
 * 131049 frequency cap on MARKETING templates · 132xxx template problems · 131050 user stopped marketing.
 */
export function explainWhatsAppFailure(err: MetaError | null | undefined, templateName: string | null | undefined): FailureExplanation {
  const code = String(err?.code ?? "");
  const text = [err?.title, err?.message, err?.error_data?.details].filter(Boolean).join(" ").toLowerCase();

  if (code === "131047" || text.includes("re-engagement") || text.includes("24 hours")) {
    return {
      reason: "טקסט חופשי מחוץ לחלון 24 השעות — ללקוח לא כתב לעסק לאחרונה",
      fix: templateName ? "לבדוק למה התבנית נדחתה ונפלה לטקסט חופשי" : "הזרימה צריכה תבנית Meta מאושרת (sendWithTemplateChain)",
      actionable: true,
    };
  }
  if (code === "131049" || text.includes("ecosystem") || text.includes("frequency")) {
    return {
      reason: "Meta הגבילה תבנית שיווקית ללקוח הזה (frequency cap)",
      fix: "להעביר את הזרימה לתבנית מסוג UTILITY",
      actionable: true,
    };
  }
  if (code.startsWith("132") || text.includes("template")) {
    return {
      reason: `בעיה בתבנית${templateName ? ` ${templateName}` : ""} (לא מאושרת / פרמטרים / מושהית)`,
      fix: "לבדוק את התבנית ב-WhatsApp Manager",
      actionable: true,
    };
  }
  if (code === "131026" || text.includes("undeliverable")) {
    return {
      reason: "לא ניתן למסור — כנראה אין למספר וואטסאפ, או שהלקוח חסם",
      fix: "לבדוק את מספר הטלפון של הלקוח",
      actionable: false,
    };
  }
  if (code === "131050") {
    return { reason: "הלקוח ביקש להפסיק לקבל הודעות שיווקיות", fix: "אין — בחירת הלקוח", actionable: false };
  }
  return {
    reason: [err?.code, err?.title, err?.message].filter(Boolean).join(" · ") || "שגיאה לא מוכרת מ-Meta",
    fix: "לבדוק ב-WhatsAppMessageLog",
    actionable: true,
  };
}

/** 0541234567 → 054-***-567 (alerts never carry a full customer number). */
export function maskPhone(phone: string | null | undefined): string {
  const d = (phone ?? "").replace(/\D/g, "").replace(/^972/, "0");
  if (d.length < 7) return "—";
  return `${d.slice(0, 3)}-***-${d.slice(-3)}`;
}

// ---------------------------------------------------------------------------
// Manual sends (customer card) — Meta answers "accepted" at once and reports a
// failure a few seconds later on the statuses webhook. The route waits briefly
// for that outcome so the business is never told "sent" for a message that failed.
// ---------------------------------------------------------------------------

export type DeliveryOutcome =
  | { state: "failed"; errorCode: string | null; errorMessage: string | null }
  | { state: "accepted"; status: string } // sent / delivered / read
  | { state: "unknown" }; // no webhook answer yet

/** Polls `getStatus` until a status other than "accepted"/null arrives or the time runs out. */
export async function waitForDeliveryOutcome(
  getStatus: () => Promise<{ status: string | null; errorCode: string | null; errorMessage: string | null } | null>,
  opts: { timeoutMs?: number; intervalMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<DeliveryOutcome> {
  const timeoutMs = opts.timeoutMs ?? 7000;
  const intervalMs = opts.intervalMs ?? 700;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let waited = 0;
  while (waited <= timeoutMs) {
    const row = await getStatus().catch(() => null);
    const status = row?.status ?? null;
    if (status === "failed") return { state: "failed", errorCode: row?.errorCode ?? null, errorMessage: row?.errorMessage ?? null };
    if (status && status !== "accepted") return { state: "accepted", status };
    if (waited >= timeoutMs) break;
    await sleep(intervalMs);
    waited += intervalMs;
  }
  return { state: "unknown" };
}

/** Hebrew text for the business (not for Or) when a manual send failed. */
export function manualSendFailureText(errorCode: string | null | undefined): string {
  const code = String(errorCode ?? "");
  if (code === "131047") {
    return "וואטסאפ דחה את ההודעה: הלקוח לא כתב למספר של פטרה ב-24 השעות האחרונות, ובמצב כזה אי אפשר לשלוח לו הודעה חופשית. שלחו אותה מהוואטסאפ שלכם.";
  }
  if (code === "131026") return "וואטסאפ לא הצליח למסור את ההודעה: ייתכן שאין וואטסאפ במספר הזה או שהלקוח חסם. בדקו את המספר.";
  return "וואטסאפ לא מסר את ההודעה. נסו לשלוח אותה מהוואטסאפ שלכם.";
}

// ---------------------------------------------------------------------------
// Message log status order. Meta can deliver status webhooks out of order and
// concurrently; the update must only move forward, atomically (updateMany on
// the current status) so "delivered" never overwrites "read".
// ---------------------------------------------------------------------------

export const WA_LOG_STATUSES = ["accepted", "sent", "delivered", "read", "failed"] as const;

/**
 * The current statuses a webhook status may overwrite.
 * sent / delivered / read → any lower progress status. failed → anything not yet read
 * or failed (a read message can't fail; a repeated failed webhook is a no-op, so the
 * owner alert fires once). Unknown status → [] (ignored).
 */
export function overwritableStatuses(next: string): string[] {
  const progress = ["accepted", "sent", "delivered", "read"];
  if (next === "failed") return ["accepted", "sent", "delivered"];
  const i = progress.indexOf(next);
  return i <= 0 ? [] : progress.slice(0, i);
}
