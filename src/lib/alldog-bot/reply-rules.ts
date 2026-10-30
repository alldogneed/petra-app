/**
 * AllDog WhatsApp bot — item 41 (Yafit's conversation, 29/10). Pure rules, tested (alldog-item41.test.ts).
 *
 *   1. Prices asked explicitly are always written out (never "כתבתי למעלה" when nothing was written);
 *      "כמה עולה כל מסלול?" → the whole short price list in one clear message; the same question a
 *      second time → the full list (the first answer was not clear).
 *   2. The bot speaks for itself in the masculine ("מבין", "מעביר", "רושם") — never "מבינה".
 *   3. One question per message; a question asked earlier in the conversation (the dog's name…) is
 *      not asked again.
 *   4. The guide offer: a yes anywhere in the customer's next messages ("אוקיי" as its own line,
 *      or inside a message that answers something else) sends the link.
 */

const clean = (t: string) => t.replace(/\s+/g, " ").trim();

// ─── 1. Prices ────────────────────────────────────────────────────────────────

/** Or's price list (29/10). Intensive / boarding: by diagnosis, installments possible. */
export const FULL_PRICE_LIST = [
  "המחירים בקצרה:",
  "• שיחת ייעוץ בטלפון: בחינם",
  "• אבחון בבית: 350 ₪, מתקזז אם ממשיכים לאילוף",
  "• שיעורים פרטיים: 350 ₪ למפגש בודד, או 300 ₪ למפגש בחבילה של מינימום 6 מפגשים",
  "• אילוף אינטנסיבי ופנסיון: לפי אבחון, ואפשר לפרוס לתשלומים",
].join("\n");

/** "כמה עולה כל מסלול?", "מה המחיר של כל אחד", "כמה עולים שיעורים פרטיים", "מחירון". */
export function asksTrackPrices(text: string): boolean {
  return /כל\s+(?:אחד|אחת|מסלול)|(?:שני|שתי|כל)\s+ה?(?:מסלולים|אפשרויות)|שיעור(?:ים)?\s+פרטי|מחירון|כמה\s+(?:עולה|עולים)\s+(?:ה)?(?:אינטנסיבי|שיעור|פנסיון|מסלול)/u.test(clean(text));
}

/** "המחירים שכתבתי למעלה", "כמו שכתבתי קודם", "שציינתי" — pointing at an earlier message. */
const BACK_REFERENCE_RE = /(?:ש|כמו\s+ש)?(?:כתבתי|ציינתי|הזכרתי|פירטתי|שלחתי)\s+(?:לך\s+)?(?:למעלה|קודם|לפני|מקודם|בהודעה\s+הקודמת)|(?:ה)?מחירים\s+ש(?:כתבתי|ציינתי|שלחתי)/u;

const sentences = (line: string) => line.split(/(?<=[.!?])\s+/u).filter((x) => x.trim());

/** Sentences that point back at an earlier message are dropped. Pure — tested. */
export function dropBackReferences(text: string): string {
  return text
    .split("\n")
    .map((line) => sentences(line).filter((s) => !BACK_REFERENCE_RE.test(s)).join(" ").trim())
    .filter((l, i, all) => l || (i > 0 && all[i - 1]))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The reply to a price question (item 40.6 + 41): no back-references; `full` (asked about every
 * track / asked again) → the full price list unless the lesson prices are already in it; else the
 * short answer unless the diagnosis price is in it. Pure — tested.
 */
export function priceAnswer(reply: string, opts: { full: boolean; shortLine: string }): string {
  const body = dropBackReferences(reply);
  if (opts.full) {
    if (/300/.test(body) && /350/.test(body)) return body;
    // The list carries the numbers; the model's own money sentences would only repeat them.
    const rest = body
      .split("\n")
      .map((line) => sentences(line).filter((s) => !/₪|ש["״']?ח|שקל|\d{3}/u.test(s)).join(" ").trim())
      .filter(Boolean)
      .join("\n");
    return rest ? `${FULL_PRICE_LIST}\n${rest}` : FULL_PRICE_LIST;
  }
  if (/350/.test(body)) return body;
  return body ? `${opts.shortLine}\n${body}` : opts.shortLine;
}

// ─── 2. The bot is masculine when it speaks about itself ──────────────────────

const SELF_VERBS: Record<string, string> = {
  מבינה: "מבין",
  מעבירה: "מעביר",
  רושמת: "רושם",
  שמחה: "שמח",
  בודקת: "בודק",
  מצטערת: "מצטער",
  ממליצה: "ממליץ",
  דואגת: "דואג",
  יודעת: "יודע",
  חושבת: "חושב",
  מעדכנת: "מעדכן",
  מסכמת: "מסכם",
  מבטיחה: "מבטיח",
  שואלת: "שואל",
  מציעה: "מציע",
};

/**
 * "מבינה למה זה מתסכל" → "מבין למה זה מתסכל"; "אני מעבירה" → "אני מעביר". Only where the bot speaks
 * for itself: at the start of a sentence or after "אני" (never "את מבינה"). Pure — tested.
 */
export function fixBotSelfGender(text: string): string {
  const verbs = Object.keys(SELF_VERBS).join("|");
  const re = new RegExp(`(^|[.!?\\n]\\s*|(?<![\\p{L}])אני\\s+(?:ממש\\s+|מאוד\\s+|לגמרי\\s+|כבר\\s+)?)(${verbs})(?![\\p{L}])`, "gu");
  return text.replace(re, (_m, pre: string, verb: string) => `${pre}${SELF_VERBS[verb] ?? verb}`);
}

/** Feminine self-reference left in a text (tests + simulator). */
export function findSelfGenderIssues(text: string): string[] {
  return fixBotSelfGender(text) === text ? [] : [`הבוט מדבר על עצמו בלשון נקבה: "${text.slice(0, 80)}"`];
}

// ─── 3. One question per message ──────────────────────────────────────────────

const QUESTION_TOPICS: Array<{ key: string; re: RegExp }> = [
  { key: "dog_name", re: /איך\s+קוראים\s+(?:לו|לה|לכלב|לכלבה|לגור|לגורה)|מה\s+שם\s+ה(?:כלב|כלבה|גור)|ולכלב\?/u },
  { key: "owner_name", re: /איך\s+קוראים\s+לך|מה\s+השם\s+שלך/u },
  { key: "city", re: /באיזו\s+עיר|באיזה\s+(?:אזור|יישוב)|איפה\s+(?:אתם|את|אתה)\s+גר/u },
  { key: "age", re: /בן\s+כמה|בת\s+כמה|מה\s+הגיל/u },
  { key: "breed", re: /איזה\s+גזע|מה\s+הגזע/u },
  { key: "since", re: /כמה\s+זמן\s+(?:הוא|היא)?\s*(?:כבר\s+)?(?:אצל|איתכם|איתך|אצלכם)/u },
  { key: "alone", re: /כמה\s+(?:שעות|זמן)\s+(?:הוא|היא)\s+(?:נשאר|נשארת)\s+לבד/u },
  { key: "fork", re: /רוב\s+העבודה/u },
  { key: "previous", re: /(?:כבר\s+)?עבדת(?:ם)?\s+עם\s+מאלף|ניסית(?:ם)?\s+(?:כבר\s+)?(?:מאלף|אילוף)/u },
  { key: "trigger", re: /למה\s+(?:החלטת(?:ם)?\s+לפנות\s+)?דווקא\s+עכשיו/u },
];

function topicsOf(question: string): string[] {
  return QUESTION_TOPICS.filter((t) => t.re.test(question)).map((t) => t.key);
}

/** Split "איך קוראים לו, ומה קורה איתו?" / "X? ו-Y?" into separate questions. */
function splitCompoundQuestion(sentence: string): string[] {
  if (!sentence.includes("?")) return [sentence];
  const parts = sentence
    .split(/,\s+(?=ו(?:מה|איך|כמה|למה|מתי|איפה|האם|באיזו|באיזה|בן|בת|מי|יש|כבר)(?![\p{L}]))/u)
    .map((p, i) => (i === 0 ? p.replace(/[,\s]+$/u, "") : p.replace(/^ו/u, "")).trim());
  return parts.length > 1 ? parts.map((p) => (p.endsWith("?") ? p : `${p}?`)) : [sentence];
}

/**
 * At most ONE question in the whole reply, and never a question whose topic the bot already asked
 * in this conversation (the dog's name twice in a row). Statements stay. Pure — tested.
 */
export function oneQuestionPerReply(reply: string, priorBotTexts: string[]): string {
  const asked = new Set(priorBotTexts.flatMap((t) => sentences(t).filter((s) => s.includes("?")).flatMap(topicsOf)));
  let questionKept = false;
  const out = reply.split("\n").map((line) => {
    if (!line.trim() || /https?:\/\//.test(line)) return line;
    const kept: string[] = [];
    for (const s of sentences(line)) {
      for (const part of splitCompoundQuestion(s)) {
        if (!part.includes("?")) {
          kept.push(part);
          continue;
        }
        const topics = topicsOf(part);
        if (topics.length && topics.every((t) => asked.has(t))) continue; // asked before
        if (questionKept) continue; // one question per message
        questionKept = true;
        kept.push(part);
      }
    }
    return kept.join(" ").trim() || null;
  });
  return out.filter((l): l is string => l !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Number of questions in a text (tests + simulator). */
export function questionCount(text: string): number {
  return text.split("\n").flatMap(sentences).flatMap(splitCompoundQuestion).filter((s) => s.includes("?")).length;
}

// ─── 4. Guide offer: a yes anywhere in the next messages ──────────────────────

/** Lines of the customer's messages (each message and each line on its own). */
export function customerLines(texts: string[]): string[] {
  return texts.flatMap((t) => t.split(/\n+/)).map((l) => l.trim()).filter(Boolean);
}

/** An explicit "no" to the offer ("לא", "לא תודה", "אין צורך"). */
export function isNoToOffer(line: string): boolean {
  return /^(?:לא|לא\s+תודה|אין\s+צורך|לא\s+צריך|תודה,?\s+לא|לא\s+כרגע)(?:[\s!.,🙏🙂]*)$/u.test(clean(line));
}

/** How many customer turns an unanswered offer stays open (then it is dropped, never offered again). */
export const OFFER_OPEN_TURNS = 3;
