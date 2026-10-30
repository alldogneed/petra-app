/**
 * AllDog WhatsApp bot — ONE journal line per conversation (Or, item 30b).
 *
 * The conversation's CallLog (`WaBotConversation.summaryCallLogId`) holds the summary ("סיכום שיחה",
 * rewritten as the conversation goes on) + the facts the rep needs as "• " lines underneath:
 *   [וואטסאפ · בוט] סיכום שיחה (24/10 16:48)
 *   כלב: גורו · … · עיר: …
 *   • לחזור טלפונית · מחפש אילוף בבית
 *   • בעיה נוספת: נובח על כלבים
 *   • אזור לבדיקה: קרני שומרון
 * "לחזור טלפונית", "בעיה נוספת", "אזור לבדיקה", "⚠ דחוף", a time the customer asked for — never
 * separate lines. Voice-note transcripts stay separate lines. Pure — tested.
 */

export const BOT_LOG_PREFIX = "[וואטסאפ · בוט]";
export const FACT_BULLET = "• ";
const DEFAULT_BODY = `${BOT_LOG_PREFIX} שיחה בוואטסאפ`;

/** Facts of these kinds are replaced (one per conversation); others are added once each. */
const SINGLE_FACTS = ["לחזור טלפונית", "אזור לבדיקה", "⚠ דחוף", "זמן לשיחה", "לא השלים"];

export const URGENT_FACT = "⚠ דחוף";
export const callbackFact = (note?: string | null) => `לחזור טלפונית${note ? ` · ${note}` : ""}`;
export const otherIssueFact = (issue: string) => `בעיה נוספת: ${issue}`;
export const areaFact = (city: string) => `אזור לבדיקה: ${city.replace(/\s+/g, " ").trim().slice(0, 100)}`;
export const urgentFact = (reason: string, quote?: string | null) =>
  `${URGENT_FACT}: ${reason}${quote ? ` · "${quote.replace(/\s+/g, " ").trim().slice(0, 200)}"` : ""}`;
/** Item 35: the customer seems to be a child — the rep talks to a parent. Always the first fact. */
export const MINOR_FACT = "⚠️ נראה שהפונה קטין – לדבר עם הורה";
export const callbackTimeFact = (when: string) => `זמן לשיחה שהלקוח ביקש: ${when}`;

export function splitBotLog(text: string | null | undefined): { body: string; facts: string[] } {
  const lines = (text ?? "").split("\n");
  const facts = lines.filter((l) => l.startsWith(FACT_BULLET)).map((l) => l.slice(FACT_BULLET.length).trim()).filter(Boolean);
  const body = lines.filter((l) => !l.startsWith(FACT_BULLET)).join("\n").trim();
  return { body, facts };
}

export function composeBotLog(body: string, facts: string[]): string {
  // Warnings (minor, urgent) first so the rep sees them before anything else (item 35).
  const rank = (f: string) => (f === MINOR_FACT ? 0 : f.startsWith("⚠") ? 1 : 2);
  const ordered = facts.map((f, i) => ({ f, i })).sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i).map((x) => x.f);
  return [body.trim() || DEFAULT_BODY, ...ordered.map((f) => `${FACT_BULLET}${f}`)].join("\n");
}

function factKey(fact: string): string | null {
  return SINGLE_FACTS.find((k) => fact.startsWith(k)) ?? null;
}

const OTHER_ISSUE_PREFIX = "בעיה נוספת:";
const STOP_WORDS = new Set(["על", "את", "עם", "של", "לא", "גם", "מאוד", "ממש", "בעיקר", "כמו", "מול", "בפני", "יותר", "הוא", "היא"]);

/** Word stems of an issue ("מושך ברצועה" → מושך, רצוע) — to see that two issues are the same thing. */
function issueStems(issue: string): string[] {
  return issue
    .split(/[\s,.;·/]+/u)
    .map((w) => w.replace(/^[והבלמש](?=\p{L}{3,})/u, "").replace(/[^\p{L}]/gu, ""))
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
    .map((w) => w.slice(0, 4));
}

/**
 * Item 41 (Yafit, 29/10: "בעיה נוספת" 11 times, nearly the same words): one "בעיה נוספת" line per lead —
 * a new one is merged into it (an item that shares a word stem with one already there is the same
 * issue and is skipped). Pure — tested.
 */
export function mergeOtherIssues(existing: string | null, incoming: string): string {
  const items = (t: string) =>
    t
      .replace(OTHER_ISSUE_PREFIX, "")
      .split(/\s*[,;·]\s*|\s+ו(?=(?:גם\s+)?\p{L}{3,}\s)/u)
      .map((x) => x.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  const out: string[] = [];
  const seen: string[][] = [];
  for (const item of [...(existing ? items(existing) : []), ...items(incoming)]) {
    const stems = issueStems(item);
    if (!stems.length || seen.some((s) => s.some((x) => stems.includes(x)))) continue;
    seen.push(stems);
    out.push(item);
  }
  return `${OTHER_ISSUE_PREFIX} ${out.join(", ")}`.slice(0, 300);
}

/** The log with this fact added (a single-kind fact replaces the older one of its kind). */
export function withFact(text: string | null | undefined, fact: string): string {
  const { body, facts } = splitBotLog(text);
  const clean = fact.replace(/\s+/g, " ").trim();
  if (!clean || facts.includes(clean)) return composeBotLog(body, facts);
  if (clean.startsWith(OTHER_ISSUE_PREFIX)) {
    // All "בעיה נוספת" lines (also old duplicated ones) become one merged line.
    const others = facts.filter((f) => f.startsWith(OTHER_ISSUE_PREFIX));
    const merged = [...others, clean].reduce<string | null>((acc, f) => mergeOtherIssues(acc, f), null)!;
    const kept = facts.filter((f) => !f.startsWith(OTHER_ISSUE_PREFIX));
    return composeBotLog(body, [...kept, merged]);
  }
  const key = factKey(clean);
  const kept = facts.filter((f) => f !== clean && (!key || factKey(f) !== key));
  return composeBotLog(body, [...kept, clean]);
}

/** The log with a new summary body; the facts stay. */
export function withBody(text: string | null | undefined, body: string): string {
  return composeBotLog(body, splitBotLog(text).facts);
}

/** The urgent fact line of a log ("⚠ דחוף: …"), if any. */
export function urgentFactOf(text: string | null | undefined): string | null {
  return splitBotLog(text).facts.find((f) => f.startsWith(URGENT_FACT)) ?? null;
}

/** The log without the facts that start with `prefix` (e.g. "לא השלים" once the customer came back). */
export function withoutFact(text: string | null | undefined, prefix: string): string {
  const { body, facts } = splitBotLog(text);
  return composeBotLog(body, facts.filter((f) => !f.startsWith(prefix)));
}
