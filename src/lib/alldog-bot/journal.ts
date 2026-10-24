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
const SINGLE_FACTS = ["לחזור טלפונית", "אזור לבדיקה", "⚠ דחוף", "זמן לשיחה"];

export const URGENT_FACT = "⚠ דחוף";
export const callbackFact = (note?: string | null) => `לחזור טלפונית${note ? ` · ${note}` : ""}`;
export const otherIssueFact = (issue: string) => `בעיה נוספת: ${issue}`;
export const areaFact = (city: string) => `אזור לבדיקה: ${city.replace(/\s+/g, " ").trim().slice(0, 100)}`;
export const urgentFact = (reason: string, quote?: string | null) =>
  `${URGENT_FACT}: ${reason}${quote ? ` · "${quote.replace(/\s+/g, " ").trim().slice(0, 200)}"` : ""}`;
export const callbackTimeFact = (when: string) => `זמן לשיחה שהלקוח ביקש: ${when}`;

export function splitBotLog(text: string | null | undefined): { body: string; facts: string[] } {
  const lines = (text ?? "").split("\n");
  const facts = lines.filter((l) => l.startsWith(FACT_BULLET)).map((l) => l.slice(FACT_BULLET.length).trim()).filter(Boolean);
  const body = lines.filter((l) => !l.startsWith(FACT_BULLET)).join("\n").trim();
  return { body, facts };
}

export function composeBotLog(body: string, facts: string[]): string {
  return [body.trim() || DEFAULT_BODY, ...facts.map((f) => `${FACT_BULLET}${f}`)].join("\n");
}

function factKey(fact: string): string | null {
  return SINGLE_FACTS.find((k) => fact.startsWith(k)) ?? null;
}

/** The log with this fact added (a single-kind fact replaces the older one of its kind). */
export function withFact(text: string | null | undefined, fact: string): string {
  const { body, facts } = splitBotLog(text);
  const clean = fact.replace(/\s+/g, " ").trim();
  if (!clean || facts.includes(clean)) return composeBotLog(body, facts);
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
