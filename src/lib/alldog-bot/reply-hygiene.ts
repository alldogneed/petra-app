/**
 * AllDog WhatsApp bot — item 43 (Or, 16/11: review of the conversations 6–16/11). Pure, no imports
 * (logic.ts uses it). Tests: alldog-item43.test.ts.
 *
 *   1. The model's own reasoning never reaches the customer (Michelle 6/11 got "כמעט כל מה שהלקוח
 *      כתב התאים לחשבון ההורמונים, אז מגיב לזה ושואל את שאלת המזלג").
 *   2. A customer who asks to talk on the phone gets at most one more question, then the closing;
 *      no voice-note reminder (Mina 13/11 asked twice and kept getting questions).
 *   3. After the closing, a bare "נציגה תחזור…" line is not sent again (0250, 16/11).
 */

const clean = (t: string) => t.replace(/\s+/g, " ").trim();
const sentences = (line: string) => line.split(/(?<=[.!?])\s+/u).filter((x) => x.trim());

// ─── 1. Leaked reasoning ──────────────────────────────────────────────────────

/**
 * The bot talks TO the customer — "הלקוח כתב / שואל" about them in the third person, "מגיב לזה",
 * "שאלת המזלג" (its internal name for the fork question) or a tool name is its own note to itself.
 */
const META_RE = new RegExp(
  [
    `(?<![\\p{L}])ה?לקוח(?:ה)?\\s+(?:\\S+\\s+){0,2}(?:כתב|כתבה|אמר|אמרה|שאל|שאלה|שואל|שואלת|ביקש|ביקשה|מבקש|מבקשת|מתאר|מתארת|ענה|ענתה|רוצה|מחפש|מחפשת|סיפר|סיפרה)(?![\\p{L}])`,
    `(?:^|[\\s,])(?:אז\\s+|עכשיו\\s+)?(?:מגיב|אגיב|נגיב|עונה|אענה)\\s+(?:לזה|על\\s+זה|לו|לה)(?![\\p{L}])`,
    `(?:^|[\\s,])(?:אז\\s+|עכשיו\\s+)?(?:שואל|אשאל|נשאל)\\s+את\\s+(?:שאלת|השאלה\\s+(?:על|של))`,
    `שאלת\\s+(?:ה)?מזלג`,
    // No \\b in this template string: the production minifier turns "\\b" into an invalid escape (16/11 build).
    `(?:save_lead|lookup_guide|schedule_callback|handoff_to_human|tool_use|system\\s+prompt)(?![A-Za-z_])`,
    `(?:^|\\s)(?:the\\s+(?:customer|user|client)\\s+(?:said|wrote|asked|wants|is)|I\\s+(?:will|should|'ll)\\s+(?:now\\s+)?(?:respond|reply|ask\\s+the))`,
  ].join("|"),
  "iu"
);

/** A sentence that is the model's note to itself. Pure — tested. */
export function isMetaNarration(sentence: string): boolean {
  return META_RE.test(clean(sentence));
}

/** Drops the model's notes to itself, sentence by sentence. Pure — tested. */
export function dropMetaNarration(text: string): string {
  if (!META_RE.test(text)) return text;
  return text
    .split("\n")
    .map((line) => (line.trim() ? sentences(line).filter((s) => !isMetaNarration(s)).join(" ").trim() || null : line))
    .filter((l): l is string => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── 2. "אפשר לדבר בטלפון" ─────────────────────────────────────────────────────

/** "אפשר לדבר בטלפון", "תתקשרו אליי", "מעדיפה שיחה", "call me". Pure — tested. */
export function asksForPhoneCall(text: string): boolean {
  const t = clean(text);
  if (/(?:לא|אל)\s+(?:\S+\s+)?(?:להתקשר|תתקשר|לדבר\s+בטלפון|שיחה)/u.test(t)) return false;
  return (
    /(?:אפשר|אפשרי|אשמח|רוצה|מעדיף|מעדיפה|מעדיפים|עדיף|יותר\s+נוח|נוח\s+לי|בוא\s+נ|בואו\s+נ)\s*(?:\S+\s+){0,3}(?:לדבר|לשוחח|שיחה|שיחת)\s+(?:\S+\s+)?(?:ב|ב?ה)?טלפון/u.test(t) ||
    /(?:^|[\s,])(?:תתקשרו|תתקשרי|תתקשר|תצלצלו|תצלצלי|שיתקשרו|שתתקשר|שתתקשרו|להתקשר\s+(?:אליי|אלי))(?![\p{L}])/u.test(t) ||
    /^(?:טלפון|בטלפון|שיחה\s+טלפונית|טלפונית)\s*[?!.🙏]*$/u.test(t) ||
    /(?:מעדיף|מעדיפה|מעדיפים|עדיף|אשמח\s+ל|רוצה)\s*(?:\S+\s+){0,2}(?:שיחה\s+)?טלפונית/u.test(t) ||
    /\b(?:call\s+me|phone\s+call|can\s+(?:you|we)\s+(?:call|talk\s+on\s+the\s+phone))\b/iu.test(t) ||
    /позвон(?:ите|и)\s+мне|по\s+телефону/iu.test(t)
  );
}

/** Context note: the customer asked for a phone call (n = how many times in this session). */
export function phoneRequestNote(n: number): string {
  return n >= 2
    ? 'הלקוח ביקש שוב לדבר בטלפון. לא שואלים יותר שום שאלה: קורא עכשיו ל-schedule_callback (note: "ביקש לדבר בטלפון") וזהו.'
    : 'הלקוח ביקש לדבר בטלפון. מכבדים את זה: "בשמחה, נציגה תחזור בטלפון". מותר לשאול רק שאלה אחת שחסרה לנציגה (קודם השם, אם לא ידוע; אחרת מה הבעיה בקצרה), ובתשובה הבאה שלו קוראים ל-schedule_callback. בלי עוד שאלות אחרי זה ובלי הסברים ארוכים.';
}

// ─── 3. No second callback promise after the closing ──────────────────────────

/** A line that is only a callback promise ("נציגה תחזור אלייך בטלפון 🙂"). */
const CALLBACK_ONLY_RE = /^(?:ו)?(?:ה)?נציג(?:ה|ת\s+AllDog)\s+(?:כבר\s+)?(?:תחזור|תתקשר|תיצור\s+קשר)(?:\s+(?:אלייך|אליך|אליכם|אלייכם|בטלפון|טלפונית|בהקדם|היום|מחר|בבוקר)){0,4}\s*[.!🙂🙏]*$/u;

/** After the closing was sent: drop lines that only repeat "נציגה תחזור…". Pure — tested. */
export function dropRepeatedCallbackLine(text: string, closingSent: boolean): string {
  if (!closingSent) return text;
  const lines = text.split("\n");
  const kept = lines.filter((l) => !CALLBACK_ONLY_RE.test(clean(l)));
  // A reply that was only that line becomes empty → nothing is sent (it was already said).
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
