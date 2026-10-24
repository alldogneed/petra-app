/**
 * AllDog WhatsApp bot — handoff mode rules (pure, unit-tested).
 *
 * After handoff_to_human the conversation is "handoff":
 *   - every customer message → alert to the rep (lead note + task + owner WhatsApp/email), with the text;
 *   - the bot keeps answering general questions (HANDOFF_MODE_NOTE, tools lookup_guide + save_lead);
 *     an explicit "I want a person" gets HUMAN_ON_THE_WAY, at most once per 6 hours; a rep who
 *     replied from Petra in the last 2 hours → the bot stays quiet;
 *   - no human contact for 24 hours (since the handoff or the rep's last reply) → back to "active";
 *   - a rep can reply from the lead card in Petra (sent through the bot number) or press "החזר לבוט".
 * Test command: "#reset" from Or's number only wipes his conversation (TEST_RESET_PHONE).
 */

export const HANDOFF_ACK_COOLDOWN_MS = 6 * 60 * 60 * 1000;
export const HANDOFF_AUTO_RESUME_MS = 24 * 60 * 60 * 1000;

import { israelParts, weekdayOfYmd } from "@/lib/alldog/time";
import { towardYou, type Gender } from "@/lib/alldog-bot/address";

/** Or's number — the only one allowed to use "#reset". */
export const TEST_RESET_PHONE = "0542560964";

/** "9725…" / "+972-54…" / "054…" → "054…". */
export function localIsraeliPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.startsWith("972") ? `0${d.slice(3)}` : d;
}

export function isResetCommand(text: string, phone: string): boolean {
  return text.trim().toLowerCase() === "#reset" && localIsraeliPhone(phone) === TEST_RESET_PHONE;
}

/**
 * Closing message after schedule_callback / handoff_to_human — Or, 24/10/2026 (11:53), singular
 * since item 25: the bot speaks for itself ("רשמתי", "אני דואג"), the customer is addressed by
 * gender ("אלייך" / "אליך"); gender unknown → "תחזור בטלפון".
 * No callback time, no trainer name, no price — the rep does all that by phone.
 * Shabbat (Fri from 14:00, Sat) → "אחרי השבת"; a holiday block in the business calendar → "אחרי החג".
 */
export function closingText(when: "soon" | "after_shabbat" | "after_holiday" = "soon", gender: Gender = "unknown"): string {
  const back = when === "after_shabbat" ? "אחרי השבת" : when === "after_holiday" ? "אחרי החג" : "בהקדם";
  const toYou = towardYou(gender);
  const callBack = toYou ? `תחזור ${toYou} טלפונית ${back}` : `תחזור בטלפון ${back}`;
  return `מעולה, רשמתי הכל 🙏 אני דואג שנציגת AllDog ${callBack}. אם יש עוד משהו בינתיים, אפשר לכתוב לי פה`;
}

/**
 * Before the closing (Or, item 28c): what happens next, so the bot does not jump to the closing.
 * The closing after it is the short one above (no repeated content).
 */
export const TRANSITION_LINE =
  "אני מעביר את כל הפרטים לנציגה. היא תסביר לך על כל התוכניות והמסלולים, ומשם תחליטו יחד אם מתאים לעבוד עם מאלף מקצועי ואיזה.";
export const TRANSITION_MARKER = "תסביר לך על כל התוכניות והמסלולים";

/** Transition line + closing (one bubble). Without the transition when it was already sent. */
export function closingWithTransition(closing: string, transitionAlreadySent = false): string {
  return transitionAlreadySent ? closing : `${TRANSITION_LINE}\n${closing}`;
}

/** Marker of the closing message in a conversation (the bot never repeats it). */
export const CLOSING_MARKER = "רשמתי הכל";
/** Closings sent before item 25 ("מעולה, קיבלנו הכל 🙏 …") still count. */
const CLOSING_MARKERS = [CLOSING_MARKER, "קיבלנו הכל"];

export function isClosingText(text: string): boolean {
  return CLOSING_MARKERS.some((m) => text.includes(m));
}

/**
 * Shabbat / holiday right now? Shabbat = Friday from 14:00 (office close) to the end of Saturday,
 * Israel time. Holiday = a calendar block of the business covering now whose reason mentions "חג".
 */
export function closingWhen(
  now: Date = new Date(),
  blocks: Array<{ startAt: Date; endAt: Date; reason: string | null }> = []
): "soon" | "after_shabbat" | "after_holiday" {
  const p = israelParts(now);
  const wd = weekdayOfYmd(p.ymd);
  if (wd === 6 || (wd === 5 && p.hhmm >= "14:00")) return "after_shabbat";
  const holiday = blocks.some((b) => b.startAt <= now && b.endAt > now && /חג/.test(b.reason ?? ""));
  return holiday ? "after_holiday" : "soon";
}

/** After handoff_to_human. */
export function handoffClosingText(when: Parameters<typeof closingText>[0] = "soon", gender: Gender = "unknown"): string {
  return closingText(when, gender);
}

/** After schedule_callback (no time is set — the rep calls). */
export function callbackClosingText(when: Parameters<typeof closingText>[0] = "soon", gender: Gender = "unknown"): string {
  return closingText(when, gender);
}

/** "מי יחזור?" after the closing — Or, 24/10; neutral since item 25 (it lives in the cached prompt). */
export const WHO_CALLS_BACK = "אחת הנציגות מהמשרד שלנו, והיא גם תתאם את המאלף שיגיע 🙂";

/** The closing was already sent in this conversation. */
export function closingAlreadySent(rows: Array<{ role: string; text: string }>): boolean {
  return rows.some((r) => r.role === "assistant" && isClosingText(r.text));
}

/** Context note once the conversation is closed (Or, 24/10: answer, never repeat the closing). */
export const CLOSED_NOTE =
  `השיחה כבר נסגרה והלקוח קיבל את הודעת הסגירה. עונים רק על מה שהוא שואל בפועל, בלי לחזור על הודעת הסגירה, בלי לאסוף שוב פרטים ובלי לקרוא שוב ל-schedule_callback. "מי יחזור?" → "${"אחת הנציגות מהמשרד שלנו, והיא גם תתאם את המאלף שיגיע 🙂"}". פרט חדש → save_lead.`;

/**
 * The bot's last message in a turn that handed off / booked a callback: the model's own lines
 * that promise a callback (or ask something) are dropped, the fixed closing is appended.
 */
export function withClosing(modelText: string, closing: string): string {
  if (isClosingText(modelText)) return modelText.includes(TRANSITION_MARKER) || !closing.includes(TRANSITION_MARKER) ? modelText : `${TRANSITION_LINE}\n${modelText.trim()}`;
  const keep = modelText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l && !/[?]/.test(l) && !/(יחזור|תחזור|יחזרו|יתקשר|תתקשר|נחזור|בהקדם|קיבלנו|רשמתי|העברתי|העברנו|מעבירה|מעביר|דואג)/.test(l));
  return [...keep, closing].join("\n\n");
}

/** The one reply to an explicit "I want a person" during a handoff — by gender (item 25). */
export function humanOnTheWay(gender: Gender = "unknown"): string {
  const toYou = towardYou(gender);
  return toYou ? `המאלף כבר בדרך ${toYou} 🙂` : "המאלף כבר בדרך, הוא יחזור בטלפון 🙂";
}
/** Gender-neutral form (also the default). */
export const HUMAN_ON_THE_WAY = humanOnTheWay("unknown");

/** The customer explicitly asks for a person (not "are you human?", not "why don't you answer"). */
export function isHumanRequest(text: string): boolean {
  const t = text.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (/^(נציג|נציגה|בן אדם|בנאדם|מאלף|אדם אמיתי)$/u.test(t)) return true;
  return /(לדבר|לשוחח|לדבר עם|תעביר|תעבירי|להעביר|תחבר|תחברי|לקבל שיחה|שיתקשר|שתתקשר|תתקשרו)[^\n]{0,25}(בן אדם|בנאדם|אדם אמיתי|נציג|נציגה|מאלף|מישהו אמיתי|מישהו מהצוות|מהמשרד)/u.test(t);
}

/** Context note for a bot turn while the conversation is with a person (Or, 24/10 — the bot does not go silent). */
export const HANDOFF_MODE_NOTE =
  "השיחה כבר הועברה לנציגה והיא תחזור ללקוח טלפונית. ממשיכים לעזור: עונים על שאלות כלליות (מחירים, מסלולים, מדריכים עם lookup_guide) וכל פרט חדש נשמר עם save_lead. לא חוזרים על הודעת הסגירה, לא אוספים שוב פרטים, לא שואלים שאלות מכירה ולא מציעים זמנים. \"מי יחזור?\" → \"אחת הנציגות מהמשרד שלנו, והיא גם תתאם את המאלף שיגיע 🙂\".";

/** A rep who replied from Petra in the last 2 hours is talking to the customer — the bot stays quiet. */
export const REP_ACTIVE_MS = 2 * 60 * 60 * 1000;
export function repIsActive(lastHumanAt: Date | null, now: Date = new Date()): boolean {
  return !!lastHumanAt && now.getTime() - lastHumanAt.getTime() < REP_ACTIVE_MS;
}


/** The "קיבלנו" reply is due when none was sent during this handoff, or the last one is ≥ 6h old. */
export function handoffAckDue(c: { handoffAt: Date | null; handoffAckAt: Date | null }, now: Date = new Date()): boolean {
  if (!c.handoffAckAt) return true;
  if (c.handoffAt && c.handoffAckAt < c.handoffAt) return true; // from an earlier handoff
  return now.getTime() - c.handoffAckAt.getTime() >= HANDOFF_ACK_COOLDOWN_MS;
}

/** Last time a person touched the conversation: the handoff itself or the rep's last reply. */
export function lastHumanTouch(c: { handoffAt: Date | null; lastHumanAt: Date | null }): Date | null {
  const t = [c.handoffAt, c.lastHumanAt].filter((d): d is Date => !!d).map((d) => d.getTime());
  return t.length ? new Date(Math.max(...t)) : null;
}

/** When a handoff conversation goes back to the bot on its own (null = not in handoff). */
export function autoResumeAt(c: { status: string; handoffAt: Date | null; lastHumanAt: Date | null }): Date | null {
  if (c.status !== "handoff") return null;
  const touch = lastHumanTouch(c);
  return touch ? new Date(touch.getTime() + HANDOFF_AUTO_RESUME_MS) : new Date(0);
}

export function shouldAutoResume(c: { status: string; handoffAt: Date | null; lastHumanAt: Date | null }, now: Date = new Date()): boolean {
  const at = autoResumeAt(c);
  return !!at && now.getTime() >= at.getTime();
}

/** Context note for the bot's first reply after the conversation came back from a handoff. */
export const RESUMED_NOTE =
  "השיחה הועברה קודם לנציגה וחזרה אליך. ממשיכים מאיפה שהלקוח נמצא, בלי לפתוח מחדש ובלי להבטיח שוב שנציגה תחזור.";

/** Lead journal line for customer messages that arrived during a handoff. */
export function handoffNoteText(texts: string[]): string {
  const body = texts.map((t) => `• ${t.replace(/\s+/g, " ").trim()}`).join("\n");
  return `[וואטסאפ · אחרי העברה לנציגה] הלקוח כתב:\n${body}`.slice(0, 4000);
}
