/**
 * AllDog WhatsApp bot — one gentle reminder, then a human closing (Or, 27/10, "38 – תיקון").
 *
 *   bot asked a question → 4–6 min of silence (random, fixed per question) → ONE reminder from a pool
 *   ("?" · "{שם}?" · voice-note line), never the same text twice in a conversation
 *   → 2 h more without an answer → a human closing ("…אני מעביר את הפנייה שלך לנציגה…"), status
 *   closed_partial, summary in Petra with "לא השלים: …" + a task for the rep.
 * Never a reminder: a rep in the conversation, after a closing, after "תודה" / "ביי", 22:00–08:00.
 * At night there is no reminder and the closing waits for 08:00. There is no closed_no_reply state.
 * Pure — tested (alldog-nudge.test.ts). DB side: nudge.ts.
 */
import { israelParts, callbackPhraseFor, callbackSlot } from "@/lib/alldog/time";
import { isQuietTime, nextSendTime } from "@/lib/alldog/missed-call-rules";
import { closingAlreadySent, repIsActive } from "@/lib/alldog-bot/handoff";
import { towardYou, type Gender } from "@/lib/alldog-bot/address";

/** Conversation status after the partial closing (WaBotConversation.status is a plain string, no DDL). */
export const CLOSED_PARTIAL_STATUS = "closed_partial";
/** WaBotMessage kinds of the bot's own messages (role "assistant"). */
export const NUDGE_KIND = "nudge";
export const PARTIAL_CLOSE_KIND = "partial_close";
/** System marker after the partial closing: `{ missing: string[] }` (role "system", no DDL). */
export const PARTIAL_CLOSED_MARKER_KIND = "partial_closed";

export const NUDGE_DELAY_MIN_MS = 4 * 60 * 1000;
export const NUDGE_DELAY_MAX_MS = 6 * 60 * 1000;
/** A reminder more than this late (cron backlog) is not sent — the closing timer runs as if it was. */
export const NUDGE_LATE_MS = 20 * 60 * 1000;
export const CLOSE_AFTER_NUDGE_MS = 2 * 60 * 60 * 1000;

export const VOICE_NUDGE = "אפשר גם להקליט הודעה קולית אם יותר נוח";
/** System-sounding reminders Or forbade — the tests check the pool never contains them. */
export const FORBIDDEN_NUDGE_RE = /עדיין\s+(?:פה|איתי|כאן)|אני\s+מחכה|מחכה\s+לתשובה|לא\s+קיבלתי\s+תשובה/u;

/** Random-looking but fixed per seed (the bot message id): 4–6 minutes. */
export function nudgeDelayMs(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const r = ((h >>> 0) % 10_000) / 10_000;
  return NUDGE_DELAY_MIN_MS + Math.floor(r * (NUDGE_DELAY_MAX_MS - NUDGE_DELAY_MIN_MS));
}

function stableIndex(seed: string, n: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return n ? h % n : 0;
}

/** The bot's message ends with a question (the last line, trailing emoji / spaces ignored). */
export function isBotQuestion(text: string): boolean {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const last = (lines[lines.length - 1] ?? "").replace(/[\s\p{Extended_Pictographic}‍️]+$/u, "");
  // Item 41 ("שפירא דב", 29/10): the opening "…אשמח לשמוע בקצרה על הכלב" asks without a "?".
  return last.endsWith("?") || /(?:אשמח|נשמח)\s+לשמוע|ספר(?:י|ו)?\s+לי\s+(?:בקצרה|על|מה)/u.test(last);
}

/** "תודה" / "ביי" / "להתראות" / "יום טוב" — the customer ended the exchange; no reminder. */
export function isThanksOrBye(text: string): boolean {
  const t = text.replace(/[\s\p{P}\p{Extended_Pictographic}‍️]+/gu, " ").trim();
  if (!t) return false;
  return /(?:^|\s)(?:תודה|תודות|ביי|bye|להתראות|יום\s+טוב|ערב\s+טוב|לילה\s+טוב|שבת\s+שלום|סבבה\s+תודה|מעולה\s+תודה)(?:\s|$)/iu.test(t) &&
    t.split(" ").length <= 6;
}

/** First name for "{שם}?" / the closing — only a name the customer typed (decided by the caller). */
export function firstNameForNudge(name: string | null | undefined): string | null {
  const first = (name ?? "").replace(/\s+/g, " ").trim().split(" ")[0] ?? "";
  if (first.length < 2 || first.length > 20 || /[\d@]/.test(first) || !/\p{L}/u.test(first)) return null;
  return first;
}

/** The reminder pool (Or, 27/10). The name variant only when the name is known. */
export function nudgePool(firstName: string | null): string[] {
  return ["?", ...(firstName ? [`${firstName}?`] : []), VOICE_NUDGE];
}

/**
 * The reminder text: a pool text never used in this conversation (`used` = earlier reminders),
 * picked by the seed. null = every text was already used → no reminder.
 */
export function pickNudge(firstName: string | null, used: string[], seed: string): string | null {
  const usedSet = new Set(used.map((u) => u.trim()));
  const left = nudgePool(firstName).filter((t) => !usedSet.has(t));
  return left.length ? left[stableIndex(seed, left.length)] : null;
}

function isQuietAt(d: Date): boolean {
  const p = israelParts(d);
  return isQuietTime(p.ymd, p.hhmm);
}

/** The time, moved to 08:00 when it falls in 22:00–08:00. */
export function outOfQuietHours(d: Date): Date {
  return nextSendTime(d);
}

/** The callback phrase of the closing: "בהקדם" while open, else `callbackSlot` ("מחר בבוקר"…). */
export function partialCallbackPhrase(now: Date, holiday = false): string {
  return holiday ? "אחרי החג" : callbackPhraseFor(callbackSlot(now));
}

/**
 * The human closing (Or, 27/10) — singular by gender, the name when known, the wording varies
 * between conversations (seed = conversation id):
 *   "{שם}, אני מעביר את הפנייה שלך לנציגה שתחזור אליך {callbackSlot}. אם יש עוד משהו להוסיף,
 *    תכתוב לי פה ואני אעדכן אותה. ואם צריך אותי, אני כאן 🙂"
 */
export function partialClosingText(opts: { firstName: string | null; gender: Gender; phrase: string; seed: string }): string {
  const toYou = towardYou(opts.gender);
  const back = toYou ? `תחזור ${toYou} ${opts.phrase}` : `תחזור בטלפון ${opts.phrase}`;
  const write = opts.gender === "f" ? "תכתבי לי פה" : opts.gender === "m" ? "תכתוב לי פה" : "אפשר לכתוב לי פה";
  const lead = opts.firstName ? `${opts.firstName}, ` : "";
  const variants = [
    `${lead}אני מעביר את הפנייה שלך לנציגה ש${back}. אם יש עוד משהו להוסיף, ${write} ואני אעדכן אותה. ואם צריך אותי, אני כאן 🙂`,
    `${lead}אני מעביר את מה שכתבת לנציגה, והיא ${back}. אם עולה עוד משהו, ${write} ואני אעביר לה. ואם צריך אותי, אני כאן 🙂`,
    `${lead}בינתיים אני מעביר את הפנייה לנציגה ש${back}. רוצה להוסיף משהו? ${write} ואני אעדכן אותה. אני כאן אם צריך 🙂`,
  ];
  return variants[stableIndex(opts.seed, variants.length)];
}

export interface NudgeMessage {
  id: string;
  role: string; // user | assistant | human
  kind: string;
  text: string;
  createdAt: Date;
}

export type NudgeDecision =
  | { action: "none"; reason: string }
  | { action: "wait"; until: Date }
  | { action: "nudge"; anchorId: string }
  | { action: "close"; anchorId: string };

/**
 * What to do now for one conversation. `messages` = the current session, no system rows, oldest
 * first. The text of the reminder is picked by the caller (pickNudge) — "none" when the pool is
 * used up, then the closing still follows.
 */
export function decideNudge(input: {
  status: string;
  lastHumanAt: Date | null;
  messages: NudgeMessage[];
  now: Date;
}): NudgeDecision {
  const { messages, now } = input;
  if (input.status !== "active") return { action: "none", reason: "status" };
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return { action: "none", reason: "customer_last" };
  if (repIsActive(input.lastHumanAt, now) || messages.some((m) => m.role === "human")) return { action: "none", reason: "rep" };
  if (closingAlreadySent(messages) || messages.some((m) => m.kind === PARTIAL_CLOSE_KIND)) return { action: "none", reason: "closed" };
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return { action: "none", reason: "customer_never_wrote" };
  if (isThanksOrBye(lastUser.text)) return { action: "none", reason: "thanks" };

  if (last.kind === NUDGE_KIND) {
    const closeAt = outOfQuietHours(new Date(last.createdAt.getTime() + CLOSE_AFTER_NUDGE_MS));
    return now >= closeAt ? { action: "close", anchorId: last.id } : { action: "wait", until: closeAt };
  }
  if (last.kind !== "text" || !isBotQuestion(last.text)) return { action: "none", reason: "not_question" };
  // The question = the bot's whole last turn (≤ 3 parts): its last part is `last`.
  const nudgeAt = new Date(last.createdAt.getTime() + nudgeDelayMs(last.id));
  if (now < nudgeAt) return { action: "wait", until: nudgeAt };
  const canNudge = !isQuietAt(nudgeAt) && !isQuietAt(now) && now.getTime() - nudgeAt.getTime() <= NUDGE_LATE_MS;
  if (canNudge) return { action: "nudge", anchorId: last.id };
  // Night (or a late run): no reminder; the closing as if it had gone out, at 08:00 at the earliest.
  const closeAt = outOfQuietHours(new Date(nudgeAt.getTime() + CLOSE_AFTER_NUDGE_MS));
  return now >= closeAt ? { action: "close", anchorId: last.id } : { action: "wait", until: closeAt };
}

/** What the customer did not give (summary fields) — the "לא השלים: …" line + the resume note. */
export function missingDetails(sum: {
  dog_name: string | null;
  dog_breed: string | null;
  dog_age: string | null;
  problem: string | null;
  city: string | null;
} | null, hasName: boolean): string[] {
  if (!sum) return [];
  const out: string[] = [];
  if (!hasName) out.push("שם");
  if (!sum.dog_name) out.push("שם הכלב");
  if (!sum.city) out.push("עיר");
  if (!sum.dog_breed) out.push("גזע");
  if (!sum.dog_age) out.push("גיל הכלב");
  if (!sum.problem) out.push("מה הבעיה");
  return out;
}

export const NOT_COMPLETED_PREFIX = "לא השלים";
/** The journal fact under the summary. */
export function notCompletedFact(missing: string[] | null): string {
  if (missing === null) return `${NOT_COMPLETED_PREFIX}: הלקוח הפסיק לענות באמצע (הסיכום האוטומטי לא נוצר)`;
  return missing.length
    ? `${NOT_COMPLETED_PREFIX}: ${missing.join(", ")} · הלקוח הפסיק לענות באמצע`
    : `${NOT_COMPLETED_PREFIX}: הלקוח הפסיק לענות באמצע (הפרטים הבסיסיים נאספו)`;
}

/** Context note when the customer writes again after the partial closing. */
export function partialResumeNote(missing: string[]): string {
  return [
    "השיחה נסגרה קודם באמצע (הלקוח הפסיק לענות, והודעת הסיום אמרה שנציגה תחזור), ועכשיו הלקוח כתב שוב. הנציגה כבר עודכנה.",
    "אל תפתח מחדש ואל תשאל שוב מה שכבר נאמר. ענה למה שכתב, ותמשיך לאסוף רק את מה שחסר" +
      (missing.length ? `: ${missing.join(", ")}.` : "."),
    "כשיש את הפרטים, סגור כרגיל (schedule_callback).",
  ].join(" ");
}
