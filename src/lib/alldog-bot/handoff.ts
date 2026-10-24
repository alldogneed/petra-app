/**
 * AllDog WhatsApp bot — handoff mode rules (pure, unit-tested).
 *
 * After handoff_to_human the conversation is "handoff":
 *   - every customer message → alert to the rep (lead note + task + owner WhatsApp/email), with the text;
 *   - the bot answers ONCE ("קיבלנו 🙂 …"), then at most once per 6 hours;
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

/** When a rep will get back: "היום" inside office hours, else the next office morning. */
export function handoffAckText(now: Date = new Date()): string {
  const p = israelParts(now);
  const today = officeHoursFor(weekdayOfYmd(p.ymd));
  // Inside today's hours, with at least half an hour left for someone to call back.
  if (today && p.hhmm >= today.open && p.hhmm < minus30(today.close)) {
    return "קיבלנו 🙂 נציגה מהצוות חוזרת אליכם היום";
  }
  for (let i = today && p.hhmm < today.open ? 0 : 1; i <= 7; i++) {
    const ymd = addDaysYmd(p.ymd, i);
    if (!officeHoursFor(weekdayOfYmd(ymd))) continue;
    if (i === 0) return "קיבלנו 🙂 נציגה מהצוות חוזרת אליכם היום בבוקר";
    if (i === 1) return "קיבלנו 🙂 נציגה מהצוות חוזרת אליכם מחר בבוקר";
    return `קיבלנו 🙂 נציגה מהצוות חוזרת אליכם ביום ${HE_WEEKDAYS[weekdayOfYmd(ymd)]} בבוקר`;
  }
  return "קיבלנו 🙂 נציגה מהצוות חוזרת אליכם בהקדם";
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
