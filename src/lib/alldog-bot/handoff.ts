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
import { israelParts, officeHoursFor, weekdayOfYmd, addDaysYmd } from "@/lib/alldog/time";

export const HANDOFF_ACK_COOLDOWN_MS = 6 * 60 * 60 * 1000;
export const HANDOFF_AUTO_RESUME_MS = 24 * 60 * 60 * 1000;

/** Or's number — the only one allowed to use "#reset". */
export const TEST_RESET_PHONE = "0542560964";

const HE_WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** "9725…" / "+972-54…" / "054…" → "054…". */
export function localIsraeliPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.startsWith("972") ? `0${d.slice(3)}` : d;
}

export function isResetCommand(text: string, phone: string): boolean {
  return text.trim().toLowerCase() === "#reset" && localIsraeliPhone(phone) === TEST_RESET_PHONE;
}

/** When a person will call back: "היום" inside office hours (≥ 30 min left), else the next office morning. */
export function callbackWhen(now: Date = new Date()): string {
  const p = israelParts(now);
  const today = officeHoursFor(weekdayOfYmd(p.ymd));
  if (today && p.hhmm >= today.open && p.hhmm < minus30(today.close)) return "היום";
  for (let i = today && p.hhmm < today.open ? 0 : 1; i <= 7; i++) {
    const ymd = addDaysYmd(p.ymd, i);
    if (!officeHoursFor(weekdayOfYmd(ymd))) continue;
    if (i === 0) return "היום בבוקר";
    if (i === 1) return "מחר בבוקר";
    return `ביום ${HE_WEEKDAYS[weekdayOfYmd(ymd)]} בבוקר`;
  }
  return "בהקדם";
}

/** Legacy "קיבלנו" line (kept for the tests / rep tooling). */
export function handoffAckText(now: Date = new Date()): string {
  return `קיבלנו 🙂 נציגה מהצוות חוזרת אליכם ${callbackWhen(now)}`;
}

const CLOSING_TAIL = "אם יש עוד משהו בינתיים, אפשר לכתוב פה";

/** Closing message after handoff_to_human (Or, 24/10): urgent → the trainer calls back. */
export function handoffClosingText(urgency: "urgent" | "normal", now: Date = new Date()): string {
  const who = urgency === "urgent" ? "המאלף שלנו יחזור" : "נציגה מהצוות תחזור";
  return `מעולה, קיבלנו הכל 🙏 ${who} אליכם ${callbackWhen(now)}. ${CLOSING_TAIL}`;
}

/** Closing message after schedule_callback. `dayLabel` = heDayLabel(ymd), e.g. "יום רביעי 29/10". */
export function callbackClosingText(dayLabel: string, hhmm: string): string {
  return `מעולה, קיבלנו הכל 🙏 נציגת AllDog תחזור אליכם ב${dayLabel} ב-${hhmm}. ${CLOSING_TAIL}`;
}

/**
 * The bot's last message in a turn that handed off / booked a callback: the model's own lines
 * that promise a callback (or ask something) are dropped, the fixed closing is appended.
 */
export function withClosing(modelText: string, closing: string): string {
  if (modelText.includes("קיבלנו הכל")) return modelText;
  const keep = modelText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l && !/[?]/.test(l) && !/(יחזור|תחזור|יחזרו|יתקשר|תתקשר|נחזור|בהקדם|קיבלנו|העברתי|מעבירה|מעביר)/.test(l));
  return [...keep, closing].join("\n\n");
}

/** The one reply to an explicit "I want a person" during a handoff. */
export const HUMAN_ON_THE_WAY = "המאלף כבר בדרך אליכם 🙂";

/** The customer explicitly asks for a person (not "are you human?", not "why don't you answer"). */
export function isHumanRequest(text: string): boolean {
  const t = text.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (/^(נציג|נציגה|בן אדם|בנאדם|מאלף|אדם אמיתי)$/u.test(t)) return true;
  return /(לדבר|לשוחח|לדבר עם|תעביר|תעבירי|להעביר|תחבר|תחברי|לקבל שיחה|שיתקשר|שתתקשר|תתקשרו)[^\n]{0,25}(בן אדם|בנאדם|אדם אמיתי|נציג|נציגה|מאלף|מישהו אמיתי|מישהו מהצוות|מהמשרד)/u.test(t);
}

/** Context note for a bot turn while the conversation is with a person (Or, 24/10 — the bot does not go silent). */
export const HANDOFF_MODE_NOTE =
  "השיחה כבר הועברה למאלף / לנציגה והם יחזרו ללקוח. ממשיכים לעזור: עונים על שאלות כלליות (מחירים, מסלולים, מדריכים עם lookup_guide), כל פרט חדש נשמר עם save_lead, ומזכירים בקצרה שהמאלף יחזור אליהם. לא אוספים שוב פרטים, לא שואלים שאלות מכירה, לא קובעים מועד חדש.";

/** A rep who replied from Petra in the last 2 hours is talking to the customer — the bot stays quiet. */
export const REP_ACTIVE_MS = 2 * 60 * 60 * 1000;
export function repIsActive(lastHumanAt: Date | null, now: Date = new Date()): boolean {
  return !!lastHumanAt && now.getTime() - lastHumanAt.getTime() < REP_ACTIVE_MS;
}

function minus30(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m - 30;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
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
