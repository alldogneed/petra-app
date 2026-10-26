/**
 * AllDog WhatsApp bot — quality checks on a whole conversation (Or, item 26h). Pure, unit-tested;
 * used by the simulator (`npm run alldog:sim`, `npm run alldog:compare`).
 *
 *   - at most MAX_QUESTIONS_BEFORE_CLOSE questions from the bot until the closing message;
 *   - at least one professional (trainer) question before the closing;
 *   - zero identity lines nobody asked for ("אני העוזר המנהלתי…");
 *   - zero bot messages identical to an earlier bot message;
 *   - zero breaches of Or's sales rules (item 37: price for intensive / boarding, promised
 *     results, "עוד מוקדם", "מאוחר מדי", own boarding, payment link, baby promise).
 */
import { identityAnswerFor } from "@/lib/alldog-bot/prompt";
import { isClosingText } from "@/lib/alldog-bot/handoff";
import { findPolicyIssues, isRepeatedMessage } from "@/lib/alldog-bot/logic";

/** Item 37: basics (3) + professional (1–2) + what the rep needs to close, all only when missing. */
export const MAX_QUESTIONS_BEFORE_CLOSE = 7;

export interface Turn {
  role: "user" | "bot";
  text: string;
}

const IDENTITY_LINE_RE = /העוזר המנהלתי|אני בוט|אני לא בן אדם/u;
/** Questions that collect the basics (name, dog, area, breed, age, how long) — not professional ones. */
const BASICS_QUESTION_RE =
  /שם\s+(?:מלא|המשפחה|הכלב|הכלבה)|איך\s+קוראים|באיזו\s+עיר|איזו\s+עיר|איפה\s+(?:את|אתה|אתם|גרים|גרה|גר)|שכונה|אזור|גזע|בן\s+כמה|בת\s+כמה|גיל|כמה\s+זמן\s+(?:הוא|היא)\s+(?:אצל|איתכם|איתך)|מאיפה/u;

/** "היי, מה קורה?" — a greeting, not a question to answer. */
const GREETING_QUESTION_RE = /^(?:היי|הי|שלום)?[\s,!]*מה\s+(?:קורה|נשמע|שלומך|שלומכם|העניינים)\s*\?$/u;

/** The questions a bot message asks (each "…?" sentence), greetings excluded. */
function questionsIn(text: string): string[] {
  return (text.match(/[^?\n.!]*\?/gu) ?? [])
    .map((q) => q.trim())
    .filter((q) => q.replace(/[\s?]/g, "").length > 0 && !GREETING_QUESTION_RE.test(q));
}

export function isProfessionalQuestion(line: string): boolean {
  return /\?/.test(line) && !BASICS_QUESTION_RE.test(line) && !IDENTITY_LINE_RE.test(line);
}

export interface ConversationReport {
  closed: boolean;
  questionsBeforeClose: number;
  professionalQuestions: number;
  identityLines: number;
  repeatedMessages: number;
  policyIssues: string[];
  problems: string[];
}

export function checkConversation(turns: Turn[]): ConversationReport {
  let closed = false;
  let questionsBeforeClose = 0;
  let professionalQuestions = 0;
  let identityLines = 0;
  let repeatedMessages = 0;
  const policyIssues: string[] = [];
  const priorBot: string[] = [];
  let lastUser = "";
  for (const t of turns) {
    if (t.role === "user") {
      lastUser = t.text;
      continue;
    }
    if (isRepeatedMessage(t.text, priorBot)) repeatedMessages++;
    policyIssues.push(...findPolicyIssues(t.text));
    if (IDENTITY_LINE_RE.test(t.text) && !identityAnswerFor(lastUser)) identityLines++;
    if (!closed) {
      if (isClosingText(t.text)) closed = true;
      else {
        const qs = questionsIn(t.text);
        questionsBeforeClose += qs.length;
        professionalQuestions += qs.filter(isProfessionalQuestion).length;
      }
    }
    priorBot.push(t.text);
  }
  const problems: string[] = [];
  if (questionsBeforeClose > MAX_QUESTIONS_BEFORE_CLOSE) problems.push(`${questionsBeforeClose} שאלות עד הסגירה (מקסימום ${MAX_QUESTIONS_BEFORE_CLOSE})`);
  if (closed && professionalQuestions === 0) problems.push("אין אף שאלה מקצועית לפני הסגירה");
  if (identityLines) problems.push(`${identityLines} הודעות זהות בלי שנשאלו`);
  if (repeatedMessages) problems.push(`${repeatedMessages} הודעות שחזרו על הודעה קודמת`);
  if (policyIssues.length) problems.push(`הפרת כללים: ${[...new Set(policyIssues)].join(", ")}`);
  return { closed, questionsBeforeClose, professionalQuestions, identityLines, repeatedMessages, policyIssues, problems };
}

/** One-line summary for the simulator / compare report. */
export function formatReport(r: ConversationReport): string {
  const head = `שאלות עד הסגירה: ${r.questionsBeforeClose} · מקצועיות: ${r.professionalQuestions} · זהות: ${r.identityLines} · חזרות: ${r.repeatedMessages}${r.closed ? "" : " · (לא נסגרה)"}`;
  return r.problems.length ? `${head} ⚠ ${r.problems.join(" · ")}` : `${head} ✓`;
}
