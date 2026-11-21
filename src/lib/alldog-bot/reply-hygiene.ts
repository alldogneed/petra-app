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

// ─── Item 44 (Or, 21/11): practical, not a bot — no empathy lines, no tips, few emoji ─────────

/**
 * Or, 21/11: "בשיחות האחרונות ממש הורגש שזה בוט, בגלל אובר אמפתיה ומלא שאלות". The reply is a busy,
 * pleasant office clerk: no "נשמע מתסכל…", no echo, no unasked tip. A safety case (a person bitten,
 * a child at risk) keeps its one serious sentence and its one safety tip.
 */
const EMPATHY_RE = new RegExp(
  [
    `^(?:וואו[,!]?\\s*|אוי[,!]?\\s*)?נשמע(?:ת)?\\s`,
    `^(?:אני\\s+)?(?:ממש\\s+|לגמרי\\s+)?מבין\\s+(?:למה|כמה|אותך|אתכם|ש|את\\s+ה)`,
    `^ממש\\s+(?:רואים|מורגש|מרגישים|מבין)`,
    `^(?:רואים|מורגש)\\s+(?:כמה|ש)`,
    `טוב\\s+ש(?:פנית|פניתם|פונים|כתבת|כתבתם)`,
    `^זה\\s+(?:מצב\\s+)?(?:ש)?(?:באמת\\s+|ממש\\s+)?(?:מלחיץ|מתסכל|מתיש|לא\\s+פשוט|לא\\s+קל|מעייף|קשה)`,
    `(?:יכול|יכולה|יכולות|יכולים)\\s+(?:ממש\\s+|מאוד\\s+)?(?:להתיש|לתסכל|להלחיץ|לשגע|להעיק)`,
    `^(?:זה\\s+)?(?:לגמרי\\s+|ממש\\s+)?(?:מובן|הגיוני)(?:\\s+מאוד)?\\s+ש`,
  ].join("|"),
  "u"
);
const TIP_RE =
  /מה\s+ש(?:אנחנו\s+)?רואים\s+הרבה|הרבה\s+פעמים\s+(?:אנחנו\s+רואים|זה\s+(?:קשור|נראה|קורה))|(?:אנחנו\s+)?שומעים\s+על\s+זה\s+הרבה|מה\s+ש(?:מקדם|עוזר)\s+הכי\s+הרבה|בדרך\s+כלל\s+(?:זה|כלב|גור)[^.?!\n]{0,60}(?:לומד|קשור|נובע)/u;
const EMOJI_RE = /\s*[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}][\u{FE0F}\u{200D}\p{Extended_Pictographic}\p{Emoji_Modifier}]*/gu;

/** An empathy opener ("נשמע מתסכל, במיוחד ש…", "ממש רואים כמה אתם משקיעים"). Pure — tested. */
export function isEmpathyLine(sentence: string): boolean {
  return EMPATHY_RE.test(clean(sentence));
}
/** An unasked professional tip ("מה שאנחנו רואים הרבה זה ש…"). Pure — tested. */
export function isUnaskedTip(sentence: string): boolean {
  return TIP_RE.test(clean(sentence));
}

/**
 * Drops empathy sentences and unasked tips (a question that rides on one is kept: "נשמע קשה, איך
 * קוראים לכלב?" → "איך קוראים לכלב?"), and keeps at most one emoji per conversation on top of the
 * opening's (`priorBotTexts`). `safety` → the text is left as written. Pure — tested.
 */
export function practicalStyle(text: string, opts: { safety?: boolean; priorBotTexts?: string[] } = {}): string {
  if (opts.safety) return text;
  const emojiUsed = (opts.priorBotTexts ?? []).filter((t) => /\p{Extended_Pictographic}/u.test(t)).length;
  let emojiLeft = emojiUsed >= 2 ? 0 : 1;
  const out = text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return line;
      const kept = sentences(line)
        .map((s) => {
          if (!isEmpathyLine(s) && !isUnaskedTip(s)) return s;
          if (!s.includes("?")) return null;
          // keep only the question that rides on the sentence
          const q = s.slice(s.lastIndexOf(",") + 1).trim();
          return q.includes("?") && !isEmpathyLine(q) ? q.replace(/^(?:ו|אז\s+)(?=\S)/u, "") : null;
        })
        .filter((s): s is string => !!s)
        .join(" ")
        .replace(EMOJI_RE, (m) => (emojiLeft-- > 0 ? m : ""))
        .replace(/\s{2,}/g, " ")
        .trim();
      return kept || null;
    })
    .filter((l): l is string => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return out;
}

// ─── Item 44: the summary's classification + the customer's own words (Or: "בקרה") ───────────

const CATEGORIES: Array<{ label: string; re: RegExp }> = [
  { label: "נשיכה / תקיפה של אדם", re: /(?:נשך|נשכה|נושך|נושכת|נשיכה|נשיכות|תקף|תקפה|תוקף|תוקפת)[^.?!\n]{0,40}(?:ילד|ילדה|תינוק|אנשים|אדם|אותי|אורח|שכן|זרים|בעלי|אשתי|הבן|הבת)/u },
  { label: "תוקפנות / תגובתיות כלפי כלבים", re: /(?:תוקף|תוקפת|מתנפל|מתנפלת|נובח|נובחת|משתגע|משתגעת|תוקפנ\S*|ריאקטיבי\S*|תגובתי\S*)[^.?!\n]{0,30}כלבים|ריב(?:ים)?\s+עם\s+כלבים/u },
  { label: "תגובתיות / תוקפנות לזרים", re: /ריאקטיבי|תגובתי|טריטוריאלי|תוקפנ|מתנפל|קופץ\s+על\s+(?:מישהו|אנשים\s+ב)|נוהם|מגרגר|נהמות/u },
  { label: "חרדת נטישה / לבד בבית", re: /חרד(?:ת|ה)\s+נטישה|(?:כש|כאשר)?(?:נשאר|נשארת|משאירים\s+אות[וה])\s+לבד|לא\s+(?:נשאר|נשארת|מסוגל|מסוגלת)\s+לבד|בוכה\s+כש|מיילל/u },
  { label: "צרכים בבית", re: /צרכים|פיפי|קקי|משתין|משתינה|גמילה/u },
  { label: "נביחות", re: /נובח|נובחת|נביחות/u },
  { label: "משיכה ברצועה", re: /מושך|מושכת|משיכ(?:ה|ות)\s+ב(?:רצועה|טיול)|רצועה/u },
  { label: "הרס / לעיסה", re: /הורס|הורסת|הרס|לועס|לועסת|מכרסם|אוכל\s+(?:רהיטים|נעליים|ספה)/u },
  { label: "קפיצות / חוסר משמעת", re: /קופץ|קופצת|קופצני|לא\s+מקשיב|לא\s+מקשיבה|משמעת|פקודות|היפראקטיב/u },
  { label: "פחדים", re: /מפחד|מפחדת|פחדן|פחדנית|חרד(?:ה|תי)?\b|רועד/u },
  { label: "פנסיון", re: /פנסיון/u },
  { label: "גור / חינוך בסיסי", re: /גור(?:ה|ים)?(?![\p{L}])|בן\s+\d+\s+שבועות|חינוך\s+בסיסי/u },
];

/** Up to 3 labels for the rep ("תגובתיות / תוקפנות לזרים · נביחות"), by the customer's own words. Pure — tested. */
export function classifyProblem(texts: string[]): string | null {
  const t = clean(texts.join(" "));
  if (!t) return null;
  const labels = CATEGORIES.filter((c) => c.re.test(t)).map((c) => c.label);
  // the general "לזרים" label is redundant next to a person bite
  const out = labels.includes("נשיכה / תקיפה של אדם") ? labels.filter((l) => l !== "תגובתיות / תוקפנות לזרים") : labels;
  return out.length ? out.slice(0, 3).join(" · ") : null;
}

/** The customer's own description, word for word (the 2 longest real messages, ≤ 400 chars). Pure — tested. */
export function customerQuote(texts: string[]): string | null {
  const real = texts
    .map(clean)
    .filter((t) => t.split(" ").length >= 4 && !/^היי\s+AllDog/iu.test(t) && !t.startsWith("["));
  if (!real.length) return null;
  const top = [...real].sort((a, b) => b.length - a.length).slice(0, 2);
  const ordered = real.filter((t) => top.includes(t)).slice(0, 2);
  return ordered.join(" | ").slice(0, 400);
}

/** Header, then "סיווג: …", the body, then "הלקוח כתב: …". Pure — tested. */
export function withControlLines(summaryText: string, userTexts: string[]): string {
  const [header, ...body] = summaryText.split("\n");
  const category = classifyProblem(userTexts);
  const quote = customerQuote(userTexts);
  return [header, category && `סיווג: ${category}`, ...body, quote && `הלקוח כתב: "${quote}"`].filter((l): l is string => !!l).join("\n");
}

/** A child or a baby next to a dog that growls / snaps — a safety case even without a bite. Pure — tested. */
export function childAtRisk(texts: string[]): boolean {
  const t = clean(texts.join(" "));
  return /(?:תינוק|תינוקת|ילד|ילדה|ילדים|פעוט|פעוטה|נכד|נכדה)[^.?!]{0,80}(?:נוהם|נוהמת|מגרגר|מגרגרת|נהמות|חושף\s+שיניים|מנסה\s+לנשוך|מאיים)|(?:נוהם|נוהמת|מגרגר|מגרגרת|חושף\s+שיניים|מנסה\s+לנשוך)[^.?!]{0,80}(?:תינוק|תינוקת|ילד|ילדה|ילדים|פעוט|פעוטה|נכד|נכדה)/u.test(t);
}

/** Context note for a safety case: the ONLY place a professional tip is allowed (Or, 21/11). */
export const SAFETY_TIP_NOTE =
  "מקרה בטיחות: כאן (ורק כאן) מותר משפט רציני אחד וטיפ בטיחות מעשי אחד (למשל: לא להשאיר את הכלב והילדים יחד בלי השגחה עד שהנציגה חוזרת). בלי הוראות אילוף ובלי הסברים ארוכים.";
