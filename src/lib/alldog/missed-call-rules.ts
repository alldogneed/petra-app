/**
 * AllDog — automatic WhatsApp after a missed call to 03-3818670 (Or, item 32). Pure rules, tested.
 * The DB / Meta side is src/lib/alldog/missed-call-wa.ts.
 */
import { MISSED_CALL_MESSAGE_KIND } from "@/lib/alldog/missed-call-labels";
import { readEnv } from "@/lib/read-env";
import { addDaysYmd, callbackSlot, eveningDepressionTime, israelInstant, israelParts, shabbatEndsAt, type CallbackSlot } from "@/lib/alldog/time";

/** Meta template (approved on the AllDog bot's WABA): no variables, Hebrew. */
export const MISSED_CALL_TEMPLATE = { name: "missed_call_followup", language: "he" } as const;

/** Or's own numbers: never, except in test mode. */
export const OR_PHONES = ["0542560964", "0542560963"];

/** No second automatic message to the same phone within this period. */
export const MISSED_CALL_DEDUP_MS = 7 * 24 * 60 * 60 * 1000;
/** An answered call from the same phone within this period → no message. */
export const ANSWERED_RECENTLY_MS = 60 * 60 * 1000;

/** WaBotMessage kinds (role "system") that track one automatic message per missed call. */
export const MISSED_CALL_KINDS = {
  pending: "missed_call_pending",
  sending: "missed_call_sending",
  sent: "missed_call_sent",
  skipped: "missed_call_skipped",
  failed: "missed_call_failed",
} as const;

/** The bot's own copy of the template message (role "assistant") — readable in the rep's chat. */
/**
 * The APPROVED body of `missed_call_followup` in Meta (Utility, he, no variables / buttons) — what the
 * customer actually receives. When the template is edited in Meta, update this text too.
 */
export const MISSED_CALL_TEMPLATE_TEXT =
  "היי, כאן צוות AllDog 🙂 ראינו שניסית להשיג אותנו ולא הספקנו לענות. אפשר לכתוב לי פה בקצרה מה קורה עם הכלב, ונציגה תחזור אליך בהקדם.";
/** The bot's copy of the sent template (role assistant) = exactly what the customer got. */
export const MISSED_CALL_SENT_TEXT = MISSED_CALL_TEMPLATE_TEXT;

/**
 * Item 32 templates per callback slot (Or, 25/10; Utility, he). Bodies word for word — update them
 * when a template changes in Meta. Not approved yet → the send falls back to `open` (logged).
 */
export const MISSED_CALL_TEMPLATES = {
  open: { name: "missed_call_followup", body: MISSED_CALL_TEMPLATE_TEXT },
  after_hours: {
    name: "missed_call_after_hours",
    body: "היי, כאן צוות AllDog 🙂 ראינו שניסית להשיג אותנו אחרי שעות הפעילות. נציגה תחזור אליך {{1}}. בינתיים, אפשר לכתוב לי פה בקצרה מה קורה עם הכלב, כדי שהיא תגיע לשיחה מוכנה?",
  },
  weekend: {
    name: "missed_call_weekend",
    body: "היי, כאן צוות AllDog 🙂 ראינו שניסית להשיג אותנו. אנחנו בחופשת סוף השבוע, ונציגה תחזור אליך ביום ראשון בבוקר. בינתיים, אפשר לכתוב לי פה בקצרה מה קורה עם הכלב, ואני אדאג שהכל יחכה לה מסודר. שבת שלום 🙂",
  },
} as const;

/** One template step: name + body params + the rendered text the customer reads. */
export interface TemplateStep {
  name: string;
  params: string[];
  text: string;
}

export function renderTemplateBody(body: string, params: string[]): string {
  return params.reduce((acc, v, i) => acc.replace(`{{${i + 1}}}`, v), body);
}

function step(t: { name: string; body: string }, params: string[]): TemplateStep {
  return { name: t.name, params, text: renderTemplateBody(t.body, params) };
}

/** The missed-call message for this slot, then the `open` template as the fallback. Pure — tested. */
export function missedCallSteps(slot: CallbackSlot): TemplateStep[] {
  const open = step(MISSED_CALL_TEMPLATES.open, []);
  if (slot.kind === "after_hours") return [step(MISSED_CALL_TEMPLATES.after_hours, [slot.phrase]), open];
  if (slot.kind === "weekend") return [step(MISSED_CALL_TEMPLATES.weekend, []), open];
  return [open];
}
/** WaBotMessage.kind of that copy (+ its chat label) — client-safe, in missed-call-labels.ts. */
export { MISSED_CALL_MESSAGE_KIND, MISSED_CALL_MESSAGE_LABEL } from "@/lib/alldog/missed-call-labels";
/** Copies stored before 25/10 carried this technical text instead of the template body. */
export const MISSED_CALL_MARKER = "(missed_call_followup)";

/** Is this conversation row our copy of the missed-call template (new kind, or a legacy marker text)? */
export function isMissedCallTemplateMessage(m: { role: string; kind?: string | null; text: string }): boolean {
  return m.role === "assistant" && (m.kind === MISSED_CALL_MESSAGE_KIND || m.text.includes(MISSED_CALL_MARKER));
}

/** For display / the model: legacy technical copies read as the real template text. */
export function displayMissedCallMessage<T extends { role: string; kind: string; text: string }>(m: T): T {
  return isMissedCallTemplateMessage(m) ? { ...m, kind: MISSED_CALL_MESSAGE_KIND, text: MISSED_CALL_TEMPLATE_TEXT } : m;
}

/** Context for the bot when the customer answers the automatic message. */
export const MISSED_CALL_CONTEXT_NOTE =
  "הלקוח התקשר למשרד (03-3818670) ולא נענה, וקיבל מאיתנו הודעת וואטסאפ אוטומטית. עכשיו הוא עונה לה: בלי הודעת פתיחה, מגיבים למה שכתב וממשיכים לאסוף פרטים כרגיל.";

export function isMissedCallWaEnabled(): boolean {
  return readEnv("ALLDOG_MISSED_CALL_WA_ENABLED")?.toLowerCase() === "true";
}
/** Test mode: Or's numbers are allowed. */
export function isMissedCallWaTestMode(): boolean {
  return readEnv("ALLDOG_MISSED_CALL_WA_TEST_MODE")?.toLowerCase() === "true";
}
/**
 * Activation time (Or, 24/10): only missed calls that STARTED at or after this instant get the
 * message — never a backfill of older calls. `ALLDOG_MISSED_CALL_WA_SINCE` = ISO time
 * ("2026-10-25T08:00:00+03:00"), set together with the switch. Missing / unreadable → nothing
 * is sent at all (fail closed).
 */
export function missedCallActivatedAt(): Date | null {
  const raw = readEnv("ALLDOG_MISSED_CALL_WA_SINCE");
  if (!raw) return null;
  const t = Date.parse(raw);
  return isNaN(t) ? null : new Date(t);
}
/** A call older than this when it is scheduled is never messaged (the webhook is realtime). */
export const MAX_CALL_AGE_AT_SCHEDULE_MS = 30 * 60 * 1000;

/** The office line the automation is for (default 03-3818670). */
export function missedCallLine(): string {
  return (readEnv("ALLDOG_MISSED_CALL_LINE") || "033818670").replace(/\D/g, "");
}

/** "0541234567" for an Israeli mobile number (05X, 10 digits); null for landlines, blocked / hidden ids. */
export function israeliMobile(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t || /anonymous|restricted|private|unknown|חסוי|חסום/.test(t)) return null;
  let d = t.replace(/\D/g, "");
  if (d.startsWith("00972")) d = d.slice(5);
  else if (d.startsWith("972")) d = d.slice(3);
  if (!d.startsWith("0")) d = `0${d}`;
  return /^05\d{8}$/.test(d) ? d : null;
}

/** "0541234567" → "972541234567" (Meta wa_id / WaBotConversation.phone format). */
export function toWaId(mobile: string): string {
  return `972${mobile.replace(/\D/g, "").replace(/^0/, "")}`;
}

/** The call went to the office line (PayCall PR_NUMBER has no leading 0). */
export function isOfficeLine(prNumber: string | null | undefined, line = missedCallLine()): boolean {
  const d = (prNumber ?? "").replace(/\D/g, "");
  return d.length >= 8 && line.length >= 8 && d.slice(-8) === line.slice(-8);
}

/**
 * Quiet hours: 22:00–08:00 every day. The weekend is no longer quiet (Or, 25/10): it has its own
 * template (`missed_call_weekend`, chosen by `callbackSlot`).
 */
export function isQuietTime(_ymd: string, hhmm: string): boolean {
  return hhmm < "08:00" || hhmm >= "22:00";
}

// ─── Item 40.3 (Or, 28/10): quiet hours for the AUTOMATIC messages (missed_call_* / lead_followup_*) ──
// A missed call at 04:36 got its WhatsApp at 04:37. Now: nothing automatic goes out 21:30–08:00, on
// Shabbat (Friday candle lighting → Shabbat end) or on a holiday (an AvailabilityBlock whose reason
// has "חג", until its end). No grace period any more; the 3–5 min form delay is checked too.

export const AUTO_QUIET_FROM = "21:30";
export const AUTO_QUIET_UNTIL = "08:00";

/** 21:30–08:00 (Israel time). */
export function isAutoQuietTime(hhmm: string): boolean {
  return hhmm < AUTO_QUIET_UNTIL || hhmm >= AUTO_QUIET_FROM;
}

/** Friday's candle lighting (Tel Aviv): 18 minutes before sunset. */
export function shabbatStartsAt(fridayYmd: string): Date {
  return new Date(eveningDepressionTime(fridayYmd, 0.833).getTime() - 18 * 60 * 1000);
}

/** A holiday block (AvailabilityBlock with "חג" in its reason). */
export interface QuietBlock {
  startAt: Date;
  endAt: Date;
  reason?: string | null;
}

export function isHolidayBlock(b: QuietBlock): boolean {
  return /חג/.test(b.reason ?? "");
}

/**
 * The first moment at or after `at` when an automatic message may go out. Pure — tested.
 * Shabbat → its end; a holiday block → its end; 21:30–08:00 → 08:00. Repeated until all pass
 * (Shabbat ending at 21:40 → Sunday 08:00).
 */
export function autoMessageSendTime(at: Date, holidays: QuietBlock[] = []): Date {
  let t = at;
  for (let i = 0; i < 10; i++) {
    const p = israelParts(t);
    if (p.weekday === 5 && t.getTime() >= shabbatStartsAt(p.ymd).getTime()) {
      t = shabbatEndsAt(addDaysYmd(p.ymd, 1));
      continue;
    }
    if (p.weekday === 6 && t.getTime() < shabbatEndsAt(p.ymd).getTime()) {
      t = shabbatEndsAt(p.ymd);
      continue;
    }
    const holiday = holidays.find((b) => isHolidayBlock(b) && b.startAt.getTime() <= t.getTime() && b.endAt.getTime() > t.getTime());
    if (holiday) {
      t = holiday.endAt;
      continue;
    }
    if (isAutoQuietTime(p.hhmm)) {
      t = israelInstant(p.hhmm < AUTO_QUIET_UNTIL ? p.ymd : addDaysYmd(p.ymd, 1), AUTO_QUIET_UNTIL);
      continue;
    }
    return t;
  }
  return t;
}

/**
 * null = send now; a Date = wait until then (Shabbat / holiday / 21:30–08:00). `_actionAt` is kept
 * for the callers' signature — since 28/10 there is no 15-minute grace any more.
 */
export function quietDeferral(_actionAt: Date | null, now: Date, holidays: QuietBlock[] = []): Date | null {
  const at = autoMessageSendTime(now, holidays);
  return at.getTime() > now.getTime() ? at : null;
}

/**
 * The template is chosen by the time of the customer's action (call / form), Or 28/10:
 *   the office is open when the message goes out → open;
 *   the action was in the weekend → weekend (sent after Shabbat ends);
 *   otherwise the slot at the send time (after hours, with "היום בבוקר" / "מחר בבוקר" for THAT moment —
 *   a 23:00 call sent at 08:00 says "היום בבוקר").
 */
export function templateSlotFor(actionAt: Date | null, sendAt: Date): CallbackSlot {
  const atSend = callbackSlot(sendAt);
  if (atSend.kind === "open") return atSend;
  if (actionAt && callbackSlot(actionAt).kind === "weekend") return { kind: "weekend" };
  return atSend;
}

/** When to send: now, or the start of the next allowed window (Israel time). */
export function nextSendTime(now: Date): Date {
  const p = israelParts(now);
  if (!isQuietTime(p.ymd, p.hhmm)) return now;
  const candidates: Date[] = [];
  for (let i = 0; i <= 3; i++) {
    const ymd = addDaysYmd(p.ymd, i);
    candidates.push(israelInstant(ymd, "08:00"));
  }
  return (
    candidates
      .filter((c) => c.getTime() > now.getTime())
      .sort((a, b) => a.getTime() - b.getTime())
      .find((c) => {
        const q = israelParts(c);
        return !isQuietTime(q.ymd, q.hhmm);
      }) ?? now
  );
}

export type SkipReason =
  | "disabled"
  | "not_office_line"
  | "not_mobile"
  | "or_phone"
  | "answered_recently"
  | "active_conversation"
  | "stopped"
  | "sent_recently"
  | "not_activated"
  | "call_time_unknown"
  | "before_activation"
  | "call_too_old";

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  disabled: "המתג כבוי",
  not_office_line: "השיחה לא הייתה ל-03-3818670",
  not_mobile: "לא מספר נייד ישראלי (נייח / חסוי)",
  or_phone: "מספר של אור (רק במצב בדיקה)",
  answered_recently: "הלקוח קיבל מענה בשיחה אחרת בשעה האחרונה",
  active_conversation: "יש שיחת בוט פעילה",
  stopped: "הלקוח ביקש להפסיק הודעות מהבוט",
  sent_recently: "כבר נשלחה הודעה כזו ב-7 הימים האחרונים",
  not_activated: "לא הוגדר זמן הפעלה (ALLDOG_MISSED_CALL_WA_SINCE)",
  call_time_unknown: "זמן השיחה לא ידוע",
  before_activation: "השיחה הייתה לפני ההפעלה",
  call_too_old: "השיחה ישנה (לא שולחים לשיחות עבר)",
};

/**
 * Or's rule: the call started at or after the activation time. `maxAgeMs` (scheduling only):
 * the call is also recent — a replayed / synced old call is never messaged. At send time the
 * age is not checked (a night call waits for 08:00), only the activation time again.
 */
export function callTimeSkipReason(
  callStart: Date | null,
  activatedAt: Date | null,
  now: Date,
  maxAgeMs: number | null = MAX_CALL_AGE_AT_SCHEDULE_MS
): SkipReason | null {
  if (!activatedAt) return "not_activated";
  if (!callStart) return "call_time_unknown";
  if (callStart.getTime() < activatedAt.getTime()) return "before_activation";
  if (maxAgeMs !== null && now.getTime() - callStart.getTime() > maxAgeMs) return "call_too_old";
  return null;
}

/** Every rule that does not need the DB / PayCall. Returns the reason to skip, or null. */
export function basicSkipReason(input: { prNumber: string | null | undefined; callerId: string | null | undefined }): SkipReason | null {
  if (!isMissedCallWaEnabled()) return "disabled";
  if (!isOfficeLine(input.prNumber)) return "not_office_line";
  const mobile = israeliMobile(input.callerId);
  if (!mobile) return "not_mobile";
  if (OR_PHONES.includes(mobile) && !isMissedCallWaTestMode()) return "or_phone";
  return null;
}

/** The bot may not open the conversation: active in the last 24 h, or the customer asked to stop. */
export function conversationSkipReason(
  conv: { status: string; lastInboundAt: Date | null } | null,
  lastMissedCallMessageAt: Date | null,
  now: Date
): SkipReason | null {
  if (conv?.status === "stopped") return "stopped";
  if (conv?.lastInboundAt && now.getTime() - conv.lastInboundAt.getTime() < 24 * 60 * 60 * 1000) return "active_conversation";
  if (conv?.status === "handoff") return "active_conversation";
  if (lastMissedCallMessageAt && now.getTime() - lastMissedCallMessageAt.getTime() < MISSED_CALL_DEDUP_MS) return "sent_recently";
  return null;
}

/** "YYYY-MM-DD HH:MM:SS" (PayCall, Israel time) → instant; null when unreadable. */
export function paycallStart(start: string | null | undefined): Date | null {
  const m = (start ?? "").match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  return m ? israelInstant(m[1], m[2]) : null;
}

/** An ANSWER call from this mobile number that started at or after `since`. */
export function answeredSince(
  calls: Array<{ CALLERID: string; DISPOSITION: string; START: string }>,
  mobile: string,
  since: Date
): boolean {
  return calls.some((c) => {
    if (c.DISPOSITION !== "ANSWER" || israeliMobile(c.CALLERID) !== mobile) return false;
    const at = paycallStart(c.START);
    return !!at && at.getTime() >= since.getTime();
  });
}
