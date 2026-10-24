/**
 * AllDog WhatsApp bot — how the bot speaks (Or, 24/10, item 25). Pure, unit-tested.
 *
 * The bot speaks about itself in the singular, masculine ("העוזר המנהלתי"): "רשמתי", "העברתי
 * לנציגה", "אני דואג שיחזרו", "אשמח לעזור". "אנחנו" only about the business itself ("אנחנו עובדים
 * מאז 2012").
 * The customer is addressed in the singular by gender: f → "אלייך", m → "אליך". Unknown → neutral
 * wording ("אפשר לכתוב פה", "הנציגה תחזור בטלפון"). Plural ("אתם / אליכם") only when the customer
 * talks about themselves in the plural ("יש לנו כלב", "ניסינו").
 *
 * The gender is worked out again every turn from the customer's own messages + name
 * (`detectGender`), so nothing is stored — the conversation itself is the record.
 */

export type Gender = "f" | "m" | "unknown";

export interface AddressStyle {
  gender: Gender;
  /** The customer talks about themselves in the plural → plural address is fine. */
  plural: boolean;
}

const L = "\\p{L}";
const NOT_L_BEFORE = `(?<![${L}])`;
const NOT_L_AFTER = `(?![${L}])`;

/** First-person words that only one gender writes ("אני יכולה" / "אני יכול"). */
const FEM_WORDS = [
  "יכולה", "צריכה", "חושבת", "יודעת", "גרה", "מפחדת", "עובדת", "מתלבטת", "מחפשת", "מעדיפה", "מבינה",
  "מודאגת", "לחוצה", "בטוחה", "שמחה", "זמינה", "נמצאת", "מרגישה", "מאמינה", "זוכרת", "שוקלת", "מתכננת",
  "אוהבת", "מבקשת", "פוחדת", "מתייאשת", "מיואשת", "עייפה", "גמורה", "מסכימה",
];
const MASC_WORDS = [
  "יכול", "צריך", "חושב", "יודע", "גר", "מפחד", "עובד", "מתלבט", "מחפש", "מעדיף", "מבין",
  "מודאג", "לחוץ", "בטוח", "שמח", "זמין", "נמצא", "מרגיש", "מאמין", "זוכר", "שוקל", "מתכנן",
  "אוהב", "מבקש", "פוחד", "מתייאש", "מיואש", "עייף", "גמור", "מסכים",
];
// "מקווה" / "רוצה" are written the same by both — they never decide on their own.
const AMBIGUOUS = new Set(["מקווה", "רוצה"]);

const FILLERS = "(?:(?:לא|ממש|כבר|פשוט|גם|די|מאוד|עדיין|כל\\s+כך|באמת|קצת|רק)\\s+){0,2}";
const FIRST_PERSON_RE = new RegExp(`${NOT_L_BEFORE}(?:ו)?אני\\s+${FILLERS}([${L}]+)${NOT_L_AFTER}`, "gu");
/** Feminine / masculine self-descriptions that do not start with "אני". */
const FEM_PHRASES = /(?<![\p{L}])(?:אמא\s+של|בעלת\s+הכלב|הבעלים\s+שלה|אני\s+אמא)(?![\p{L}])/u;
const MASC_PHRASES = /(?<![\p{L}])(?:אבא\s+של|בעל\s+הכלב|אני\s+אבא)(?![\p{L}])/u;

/** Common Israeli first names. Unisex names (יובל, שי, נועם, עדי…) are in neither list. */
const FEM_NAMES = new Set([
  "רויטל", "מיכל", "שירה", "יעל", "רונית", "מאיה", "דנה", "אורית", "ליאת", "נועה", "תמר", "שרון", "אסתר",
  "רחל", "שרה", "לאה", "רבקה", "חנה", "מירב", "מורן", "אפרת", "הילה", "קרן", "סיגל", "ענבל", "אילנה",
  "גלית", "רינת", "לימור", "אורנה", "דפנה", "טליה", "אביגיל", "נעמה", "שני", "הדס", "עינב", "רוני",
  "ליה", "אלה", "אלינור", "שקד", "יעלי", "אנה", "מרים", "ציפי", "פנינה", "בתיה", "דורית", "שושנה", "ורד",
  "סיון", "אושרת", "מיטל", "קרינה", "אולגה", "ויקי", "לירון", "רותם", "שלומית", "אתי", "יהודית", "חיה",
]);
const MASC_NAMES = new Set([
  "דני", "יוסי", "אבי", "משה", "דוד", "יוסף", "אברהם", "יצחק", "יעקב", "חיים", "שלמה", "מיכאל", "אמיר",
  "רון", "איתי", "עידו", "אורי", "יונתן", "נדב", "אלון", "גיל", "רועי", "עמרי", "אסף", "ערן", "אייל",
  "גיא", "תומר", "עומר", "אריאל", "בן", "איתן", "שמעון", "מאיר", "ניר", "רפי", "אלי", "צחי", "קובי",
  "מוטי", "שאול", "ברק", "דור", "נתנאל", "אהרון", "בועז", "גלעד", "אלעד", "עוז", "ליאור", "ג׳ון", "ג'ון",
  "ירון", "אופיר", "זיו", "רז", "אורן", "שגיא", "רמי", "יגאל", "ישראל", "שי", "אור",
]);
// Unisex in Israel → never decide alone (removed from the lists even if added above).
const UNISEX_NAMES = new Set(["יובל", "שי", "נועם", "עדי", "טל", "גל", "אור", "ליאור", "הדר", "שחר", "רוני", "חן", "עמית", "נוי", "אופיר", "דניאל", "שגיא", "רותם", "לירון", "שקד", "עדן", "מעיין", "אביב", "ספיר", "רז", "זיו"]);

function nameGender(name: string | null | undefined): Gender {
  const first = name?.trim().split(/\s+/)[0]?.replace(/[^\p{L}׳']/gu, "") ?? "";
  if (!first || UNISEX_NAMES.has(first)) return "unknown";
  if (FEM_NAMES.has(first)) return "f";
  if (MASC_NAMES.has(first)) return "m";
  return "unknown";
}

/**
 * The customer's gender from what they wrote about themselves (first-person words win) and, failing
 * that, their first name. Conflicting evidence → "unknown".
 */
export function detectGender(input: { texts: string[]; name?: string | null }): Gender {
  let f = 0;
  let m = 0;
  for (const text of input.texts) {
    for (const match of text.matchAll(FIRST_PERSON_RE)) {
      const w = match[1];
      if (AMBIGUOUS.has(w)) continue;
      if (FEM_WORDS.includes(w)) f++;
      else if (MASC_WORDS.includes(w)) m++;
    }
    if (FEM_PHRASES.test(text)) f++;
    if (MASC_PHRASES.test(text)) m++;
  }
  if (f > m) return "f";
  if (m > f) return "m";
  if (f > 0) return "unknown"; // a tie between real evidence
  return nameGender(input.name);
}

/** "יש לנו כלב", "ניסינו", "אנחנו גרים" — the customer speaks for a household. */
const PLURAL_SELF_RE = /(?<![\p{L}])(?:ו)?(?:אנחנו|יש\s+לנו|אצלנו|שלנו|אותנו|ניסינו|אימצנו|קנינו|הבאנו|לקחנו|עברנו|חשבנו|רצינו|גרים|מחפשים|רוצים|צריכים)(?![\p{L}])/u;

export function speaksPlural(texts: string[]): boolean {
  return texts.some((t) => PLURAL_SELF_RE.test(t));
}

export function addressStyleFor(input: { texts: string[]; name?: string | null }): AddressStyle {
  return { gender: detectGender(input), plural: speaksPlural(input.texts) };
}

/** "אלייך" / "אליך" — the closing's "to you". */
export function towardYou(g: Gender): string | null {
  return g === "f" ? "אלייך" : g === "m" ? "אליך" : null;
}

/** Context line for the model: how to address this customer. */
export function addressNote(style: AddressStyle): string {
  const who =
    style.gender === "f"
      ? 'הלקוחה אישה: פונים אליה ביחיד בנקבה ("את", "אלייך", "לך", "תכתבי").'
      : style.gender === "m"
        ? 'הלקוח גבר: פונים אליו ביחיד בזכר ("אתה", "אליך", "לך", "תכתוב").'
        : 'המגדר של הלקוח לא ידוע: ניסוח ניטרלי בלי פנייה במגדר ("אפשר לכתוב פה", "מה שם הכלב ?", "הנציגה תחזור בטלפון").';
  const plural = style.plural
    ? " הלקוח מדבר על עצמו ברבים (משפחה), אז מותר גם \"אתם\"."
    : ' בלי "אתם / אליכם / לכם".';
  return who + plural;
}

// ─── Deterministic fixes on what the model wrote ───────────────────────────────

function wordRe(word: string, prefixes = "[ושה]?"): RegExp {
  return new RegExp(`${NOT_L_BEFORE}(${prefixes})${word}${NOT_L_AFTER}`, "gu");
}

/** The bot speaking as "we" about what IT did → singular masculine (always). */
const SELF_FIXES: Array<[RegExp, string]> = [
  [wordRe("רשמנו"), "$1רשמתי"],
  [wordRe("העברנו"), "$1העברתי"],
  [wordRe("שמרנו"), "$1שמרתי"],
  [wordRe("קיבלנו\\s+(?:את\\s+)?הכל"), "$1רשמתי הכל"],
  [wordRe("אנחנו\\s+דואגים"), "$1אני דואג"],
  [wordRe("נדאג"), "$1אדאג"],
  [wordRe("נשמח\\s+לעזור"), "$1אשמח לעזור"],
  [wordRe("נעביר"), "$1אעביר"],
];

/** Plural address → singular, by gender (only when the customer did not speak in the plural). */
const ADDRESS_BY_GENDER: Array<[string, { f: string; m: string }]> = [
  ["אתכם", { f: "אותך", m: "אותך" }],
  ["אליכם", { f: "אלייך", m: "אליך" }],
  ["לכם", { f: "לך", m: "לך" }],
  ["שלכם", { f: "שלך", m: "שלך" }],
  ["איתכם", { f: "איתך", m: "איתך" }],
  ["אצלכם", { f: "אצלך", m: "אצלך" }],
  ["עליכם", { f: "עלייך", m: "עליך" }],
  ["מכם", { f: "ממך", m: "ממך" }],
  ["אתם", { f: "את", m: "אתה" }],
  ["ספרו", { f: "ספרי", m: "ספר" }],
  ["כתבו", { f: "כתבי", m: "כתוב" }],
  ["שלחו", { f: "שלחי", m: "שלח" }],
  ["תכתבו", { f: "תכתבי", m: "תכתוב" }],
  ["תשלחו", { f: "תשלחי", m: "תשלח" }],
  ["תספרו", { f: "תספרי", m: "תספר" }],
];

/** Gender unknown: the common plural phrases → neutral wording. */
const NEUTRAL_FIXES: Array<[RegExp, string]> = [
  [/(?<![\p{L}])((?:ש|ו)?(?:תחזור|יחזור|יחזרו|תחזורנה|נחזור|יתקשר|תתקשר|יתקשרו))\s+אליכם(?:\s+טלפונית)?/gu, "$1 בטלפון"],
  [/(?<![\p{L}])ספרו\s+(?:לי|לנו)\s+/gu, "אשמח לשמוע "],
  [/(?<![\p{L}])ספרו\s+/gu, "אשמח לשמוע "],
  [/(?<![\p{L}])(?:איפה|באיזו\s+עיר)\s+אתם\s+גרים\s*\?/gu, "באיזו עיר ושכונה מדובר ?"],
  [/(?<![\p{L}])(ה?כלב)\s+שלכם(?![\p{L}])/gu, "$1"],
  [/(?<![\p{L}])(ה?כלבה)\s+שלכם(?![\p{L}])/gu, "$1"],
];

/** Applied to every bot reply (after the model, before sending). */
export function applyAddressStyle(text: string, style: AddressStyle): string {
  let out = text;
  for (const [re, to] of SELF_FIXES) out = out.replace(re, to);
  if (style.plural) return out;
  if (style.gender === "unknown") {
    for (const [re, to] of NEUTRAL_FIXES) out = out.replace(re, to);
    return out;
  }
  for (const [word, forms] of ADDRESS_BY_GENDER) out = out.replace(wordRe(word, "[ו]?"), `$1${forms[style.gender]}`);
  return out;
}

export interface AddressIssue {
  kind: "self_plural" | "plural_address";
  text: string;
}

const SELF_PLURAL_RE = /(?<![\p{L}])[ושה]?(?:רשמנו|העברנו|שמרנו|אנחנו\s+דואגים|נדאג|קיבלנו\s+(?:את\s+)?הכל)(?![\p{L}])/u;
const PLURAL_ADDRESS_RE = /(?<![\p{L}])[ושה]?(?:אתם|אתכם|אליכם|לכם|שלכם|איתכם|אצלכם|עליכם|ספרו|כתבו|שלחו|תכתבו|תשלחו|תספרו)(?![\p{L}])/u;

/** What the tests and the simulator flag: "we did" about the bot, plural address the customer didn't use. */
export function findAddressIssues(text: string, style: AddressStyle): AddressIssue[] {
  const issues: AddressIssue[] = [];
  const self = text.match(SELF_PLURAL_RE);
  if (self) issues.push({ kind: "self_plural", text: self[0].trim() });
  if (!style.plural) {
    const plural = text.match(PLURAL_ADDRESS_RE);
    if (plural) issues.push({ kind: "plural_address", text: plural[0].trim() });
  }
  return issues;
}
