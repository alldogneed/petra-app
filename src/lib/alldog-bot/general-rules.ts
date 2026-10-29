/**
 * AllDog WhatsApp bot — item 40 (Or, 28/10). Pure rules, tested (alldog-item40.test.ts).
 *
 *   1. A request that is not about the caller's dog (the owner / management, a supplier, a trainer
 *      looking for work, a collaboration / media, an existing customer's invoice / payment /
 *      complaint, an existing customer looking for their trainer) → no dog questions, at most one
 *      question ("על מה מדובר, בכמה מילים?" / "ואיך קוראים לך?"), one human closing line, a task
 *      "פנייה כללית: <שם> – <נושא>" for Or, no new lead.
 *   2. The customer is already talking to a rep ("אני איתה בטלפון", "רחלי חזרה אליי וקבענו") →
 *      one line, the conversation goes to the rep; "התקשרתי חזרה ולא ענו" → urgent task + one
 *      question about a good time.
 *   5. Who calls back is always "נציגת AllDog" — never a promise that a trainer will call.
 *   6. A price question gets the numbers (free consultation, 350 ₪ diagnosis that is offset).
 */
import type { Gender } from "@/lib/alldog-bot/address";

export type GeneralKind = "owner" | "supplier" | "job" | "partnership" | "billing" | "complaint" | "own_trainer";

const clean = (t: string) => t.replace(/\s+/g, " ").trim();
const L = "[\\p{L}\"'׳״]";

// ─── 1. Detection ─────────────────────────────────────────────────────────────

const OWNER_RE = new RegExp(
  [
    `(?:לדבר|לשוחח|ליצור\\s+קשר|להשיג|מספר(?:\\s+הטלפון)?|הנייד|הטלפון)\\s+(?:רגע\\s+)?(?:עם|של|את)\\s+(?:ה)?(?:בעלים(?!\\s+של\\s+ה?כלב)|מנהל(?:ת)?|הנהלה|האחראי(?:ת)?|אחראי(?:ת)?|אור(?!\\p{L}))`,
    `מי\\s+(?:ה)?(?:מנהל(?:ת)?|בעלים|אחראי(?:ת)?)(?:\\s+(?:פה|כאן|בעסק|בחברה|של\\s+\\S+))?\\s*\\??\\s*$`,
    `^(?:היי\\s*,?\\s*|שלום\\s*,?\\s*)?(?:אפשר|אפשרי)\\s+(?:את\\s+)?(?:ה)?(?:בעלים|מנהל(?:ת)?|הנהלה)`,
  ].join("|"),
  "u"
);
const SUPPLIER_RE =
  /אני\s+(?:מוכר|מוכרת|משווק|משווקת|יבואן|יבואנית|ספק|ספקית|נציג(?:ה)?\s+(?:של|מטעם|מחברת)|מחברת)|(?:מציע|מציעה|מציעים)\s+(?:לכם|לך|לעסק)|(?:ספק|ספקית|מפיץ|מפיצה)\s+(?:של|מזון|ציוד|חטיפים)|הצעה\s+(?:עסקית|לעסק)|קידום\s+(?:אתרים|בגוגל|ממומן)|(?:בניית|בונה|בונים)\s+אתרים|לשפר\s+את\s+(?:ה)?דירוג/u;
const JOB_RE =
  /(?:מחפש|מחפשת)\s+(?:עבודה|משרה|מקום\s+עבודה)|(?:רוצה|מעוניין|מעוניינת|אשמח|מבקש|מבקשת)\s+(?:לעבוד|להצטרף|להתנדב)(?:\s+(?:אצלכם|איתכם|לצוות|כמאלף|כמאלפת|בתור|ב-?AllDog))?|קורות\s+חיים|(?:דרושים|גיוס)\s+(?:מאלפים|מאלפות)|משרת\s+מאלף|עבודה\s+כמאלף/u;
const PARTNERSHIP_RE =
  /שיתוף\s+פעולה|שת"פ|שת״פ|(?:כתבה|ראיון|תחקיר|פודקאסט)\s+(?:על|עם|ב|ל)|עיתונאי(?:ת)?|(?:לפרסם|פרסום|ממומן)\s+(?:אצלכם|אצלך|בעמוד|באתר|שלכם)|משפיען|משפיענית|אינפלואנסר|(?:ערוץ|עמוד)\s+(?:ה)?(?:אינסטגרם|טיקטוק|יוטיוב)\s+שלי/u;
const BILLING_RE =
  /חשבונית|(?:לא\s+)?(?:קיבלתי|שלחתם|קיבלנו)\s+(?:את\s+)?(?:ה)?קבלה|קבלה\s+(?:על|עבור)\s+(?:ה)?תשלום|חויבתי|חייבו\s+אותי|חיוב\s+(?:כפול|שגוי|לא\s+נכון|מיותר)|(?:מגיע\s+לי|רוצה|מבקש(?:ת)?|לקבל)\s+(?:את\s+)?(?:ה)?(?:החזר|זיכוי|כסף\s+בחזרה)|להחזיר\s+(?:לי\s+)?(?:את\s+)?(?:ה)?כסף|(?:לבטל|ביטול)\s+(?:את\s+)?(?:ה)?(?:הוראת\s+(?:ה)?קבע|חיוב)|שילמתי\s+(?:פעמיים|כפול)/u;
const COMPLAINT_RE =
  /(?:להגיש|רוצה\s+להגיש|יש\s+לי|הגשתי)\s+תלונה|(?:לא\s+מרוצה|לא\s+מרוצים|מאוכזב(?:ת|ים)?|מתוסכל(?:ת|ים)?)\s+(?:מ|מה|מהשירות|מהמאלף|מהמאלפת|מאיך)|שירות\s+(?:גרוע|מחפיר|על\s+הפנים|לא\s+מקצועי)|(?:ה)?(?:מאלף|מאלפת)\s+(?:שלי\s+|שלנו\s+)?(?:לא\s+(?:הגיע|הגיעה|הופיע|הופיעה))/u;
const OWN_TRAINER_CONTACT_RE = new RegExp(
  `(?:לדבר|לשוחח|להשיג|ליצור\\s+קשר|לתפוס)\\s+(?:עם|את)\\s+(${L}{2,15})\\s*,?\\s*(?:ה)?(?:מאלף|מאלפת)\\s+(?:שלי|שלנו)`,
  "u"
);
const OWN_TRAINER_RE =
  /(?:ה)?(?:מאלף|מאלפת)\s+(?:שלי|שלנו)(?!\s+(?:הקודם|הקודמת|לשעבר))[^.?!\n]{0,40}(?:לא\s+(?:חוזר|חזר|חוזרת|חזרה|עונה|ענה|ענתה)|שיחזור|שתחזור|שיתקשר|שתתקשר|לדבר|להשיג|מספר|טלפון)|(?:לדבר|לשוחח|להשיג|ליצור\s+קשר)\s+(?:עם\s+)?(?:ה)?(?:מאלף|מאלפת)\s+(?:שלי|שלנו)(?!\s+(?:הקודם|הקודמת|לשעבר))|(?:איפה|מתי\s+מגיע|מתי\s+מגיעה)\s+(?:ה)?(?:מאלף|מאלפת)\s+(?:שלי|שלנו)/u;
const PAST_TRAINER_RE = /(?:היה\s+(?:לי|לנו)|ניסינו|ניסיתי|עבדנו\s+עם)\s+(?:\S+\s+){0,2}(?:מאלף|מאלפ)|(?:מאלף|מאלפת)\s+(?:קודם|קודמת|לשעבר|הקודם|הקודמת)/u;

/** The caller talks about THEIR dog / a dog problem → the normal flow (Or: "if a dog needs help, back to the regular flow"). */
const DOG_NEED_RE =
  /(?:ה)?(?:כלב|כלבה|גור|גורה|גורים|כלבים|כלבות)\s+(?:שלי|שלנו)|יש\s+(?:לי|לנו)\s+(?:כלב|כלבה|גור|גורה|כלבים)|(?:נושך|נושכת|נובח|נובחת|נביחות|תוקפני|תוקפנית|תוקף|תוקפת|מושך|מושכת|קופץ|קופצת|מיילל|מייללת|הורס|הורסת)(?![\p{L}])|חרדת|פיפי|צרכים\s+בבית|לאלף\s+את|(?:צריך|צריכה|צריכים)\s+(?:עזרה\s+)?(?:עם|ב)\s*(?:ה)?(?:כלב|גור|אילוף)|אילוף\s+ל(?:כלב|גור)|לאמץ|אימצנו|אימצתי/u;

export function mentionsDogNeed(text: string): boolean {
  return DOG_NEED_RE.test(clean(text));
}

/**
 * Which kind of non-dog request this is, or null. An existing customer's matters (their trainer,
 * an invoice / payment, a complaint) win even when the dog is mentioned; the others only when the
 * caller does not describe a dog of their own. Pure — tested.
 */
export function generalInquiryKind(raw: string): GeneralKind | null {
  const t = clean(raw);
  if (!t) return null;
  if (!PAST_TRAINER_RE.test(t) && (OWN_TRAINER_CONTACT_RE.test(t) || OWN_TRAINER_RE.test(t))) return "own_trainer";
  if (BILLING_RE.test(t)) return "billing";
  if (COMPLAINT_RE.test(t)) return "complaint";
  if (mentionsDogNeed(t)) return null;
  if (JOB_RE.test(t)) return "job";
  if (PARTNERSHIP_RE.test(t)) return "partnership";
  if (SUPPLIER_RE.test(t)) return "supplier";
  if (OWNER_RE.test(t)) return "owner";
  return null;
}

/** "ליעד" from "אני רוצה לדבר עם ליעד, המאלף שלי" (null when no name). */
export function trainerNameOf(raw: string): string | null {
  const t = clean(raw);
  const m = OWN_TRAINER_CONTACT_RE.exec(t) ?? new RegExp(`(?:ה)?(?:מאלף|מאלפת)\\s+(?:שלי|שלנו)\\s*,?\\s*(${L}{2,15})(?=\\s*(?:,|\\.|\\?|!|$|לא|שי|שת))`, "u").exec(t);
  const name = m?.[1]?.replace(/^ה(?=מאלף)/u, "") ?? null;
  if (!name || /^(?:לא|הוא|היא|שלי|שלנו|כבר|עדיין|אתמול|היום)$/u.test(name)) return null;
  return name;
}

/** The trainer is a woman ("המאלפת שלי") → "שתחזור". */
function trainerIsFemale(raw: string): boolean {
  return /מאלפת/u.test(raw);
}

const OWNER_STRIP_RE = new RegExp(OWNER_RE.source, "gu");

/**
 * Is the subject missing? Only for "can I talk to the owner?" with nothing else — every other kind
 * already says what it is about. Pure — tested.
 */
export function generalTopicMissing(kind: GeneralKind, raw: string): boolean {
  if (kind !== "owner") return false;
  const rest = clean(raw)
    .replace(OWNER_STRIP_RE, " ")
    .replace(/[?!.,:;🙂🙏]/gu, " ")
    .replace(/(?:^|\s)(?:היי|שלום|הי|בבקשה|תודה|אפשר|אני|רוצה|רציתי|האם|יש|לי|את|עם|פה|כאן|רגע|בוקר|טוב|ערב)(?=\s|$)/gu, " ");
  return clean(rest).split(" ").filter((w) => w.length > 1).length < 3;
}

/** A typed name ("קוראים לי דנה", "שמי דנה כהן", "מדברת דנה"). */
export function typedNameOf(raw: string): string | null {
  const m = new RegExp(`(?:קוראים\\s+לי|שמי|מדבר(?:ת)?|כאן)\\s+(${L}{2,15}(?:\\s+${L}{2,15})?)`, "u").exec(clean(raw));
  const name = m?.[1]?.replace(/\s+(?:מ|ו|ש)\S*$/u, "").trim() ?? null;
  return name && !/^(?:ה|ב|ל|מ)?(?:כלב|גור|בעלים|מנהל|ספק)/u.test(name) ? name : null;
}

/** A WhatsApp profile name that looks like a person's name (letters only, ≤ 3 words). */
export function looksLikeName(name: string | null | undefined): boolean {
  const t = clean(name ?? "");
  return /^[\p{L}][\p{L}'"׳״.\- ]{1,30}$/u.test(t) && t.split(" ").length <= 3;
}

export const GENERAL_TOPIC_QUESTION = "על מה מדובר, בכמה מילים?";
export const GENERAL_NAME_QUESTION = "ואיך קוראים לך?";

/** The ONE question of a general request (null = nothing missing). */
export function generalQuestion(missing: { topic: boolean; name: boolean }): string | null {
  if (missing.topic && missing.name) return `${GENERAL_TOPIC_QUESTION} ${GENERAL_NAME_QUESTION}`;
  if (missing.topic) return GENERAL_TOPIC_QUESTION;
  if (missing.name) return "איך קוראים לך?";
  return null;
}

function stableIndex(seed: string, n: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return n ? h % n : 0;
}

/**
 * The one human closing line (no call-center language, no phone number, no time promise),
 * varied by the conversation id. Pure — tested.
 */
export function generalClosingLine(kind: GeneralKind, gender: Gender, seed: string, opts: { trainer?: string | null; trainerFemale?: boolean } = {}): string {
  const to = gender === "f" ? "אלייך" : "אליך";
  const lines: Record<GeneralKind, string[]> = {
    owner: [`הבנתי 🙂 אני מעביר את זה לאור, הבעלים של AllDog, והוא יחזור ${to}`, `תודה 🙂 אני מעביר את זה לאור, הבעלים של AllDog, והוא יחזור ${to}`],
    supplier: [`תודה, אני מעביר את זה לאור והוא יחזור ${to} אם זה רלוונטי`, `תודה רבה 🙂 העברתי את זה לאור, והוא יחזור ${to} אם זה רלוונטי`],
    job: [`תודה, אני מעביר את זה לאור והוא יחזור ${to} אם זה רלוונטי`, `תודה על הפנייה 🙂 העברתי את זה לאור, והוא יחזור ${to} אם זה רלוונטי`],
    partnership: [`תודה, אני מעביר את זה לאור והוא יחזור ${to} אם זה רלוונטי`, `תודה רבה 🙂 העברתי את זה לאור, והוא יחזור ${to} אם זה רלוונטי`],
    billing: [`אני מצטער לשמוע. אני מעביר את זה עכשיו לאור, והוא יחזור ${to}`, `מצטער על זה. אני מעביר את זה עכשיו לאור, והוא יחזור ${to}`],
    complaint: [`אני מצטער לשמוע. אני מעביר את זה עכשיו לאור, והוא יחזור ${to}`, `מצטער מאוד לשמוע. אני מעביר את זה עכשיו לאור, והוא יחזור ${to}`],
    own_trainer: opts.trainer
      ? [`אני מעדכן את ${opts.trainer} ש${opts.trainerFemale ? "ת" : "י"}חזור ${to}`]
      : [`אני מעדכן את ${opts.trainerFemale ? "המאלפת" : "המאלף"} שלך ש${opts.trainerFemale ? "ת" : "י"}חזור ${to}`],
  };
  const pool = lines[kind];
  return pool[stableIndex(seed, pool.length)];
}

export function generalClosingFor(kind: GeneralKind, gender: Gender, seed: string, texts: string[]): string {
  const all = texts.join("\n");
  return generalClosingLine(kind, gender, seed, kind === "own_trainer" ? { trainer: trainerNameOf(all), trainerFemale: trainerIsFemale(all) } : {});
}

export const GENERAL_KIND_LABELS: Record<GeneralKind, string> = {
  owner: "מבקש לדבר עם הבעלים",
  supplier: "ספק / מכירות",
  job: "עבודה / הצטרפות לצוות",
  partnership: "שיתוף פעולה / פרסום",
  billing: "תשלום / חשבונית (לקוח קיים)",
  complaint: "תלונה (לקוח קיים)",
  own_trainer: "לקוח קיים מחפש את המאלף שלו",
};

/** "פנייה כללית: <שם> – <נושא בשורה אחת>" (≤ 140 chars). */
/** The subject in one line: no greeting, no "קוראים לי …", no stray punctuation. Pure — tested. */
export function topicLine(topic: string): string {
  return clean(topic)
    .replace(new RegExp(`\\s*,?\\s*(?:ו)?(?:קוראים\\s+לי|שמי)\\s+${L}{2,15}(?:\\s+${L}{2,15})?`, "gu"), "")
    .replace(/^(?:היי|הי|שלום|אהלן|בוקר\s+טוב|ערב\s+טוב|צהריים\s+טובים)\s*[,!.]*\s*/u, "")
    .replace(/\s+,/g, ",")
    .replace(/^[,.\s]+|[,.\s]+$/g, "")
    .trim();
}

export function generalTaskTitle(name: string, kind: GeneralKind, topic: string): string {
  const line = topicLine(topic).slice(0, 80) || GENERAL_KIND_LABELS[kind];
  return `פנייה כללית: ${name} – ${line}`.slice(0, 140);
}

/** Once the general request is closed, the bot answers further messages once with this. */
export const GENERAL_FOLLOWUP_ACK = "רשמתי, אעביר גם את זה 🙏";

// ─── 2. Already in touch with a rep ───────────────────────────────────────────

const NEGATED_CONTACT_RE = /(?:לא|טרם|אף\s+אחד|עדיין\s+לא|אף\s+אחת)\s+(?:\S+\s+){0,2}(?:חזר|חזרה|חזרו|התקשר|התקשרה|התקשרו|דיבר|דיברה|דיברו|ענ)/u;
const REP_MISSED_RE =
  /(?:התקשרתי|חזרתי|ניסיתי\s+(?:לחזור|להתקשר|להשיג))[^.?!\n]{0,30}(?:ולא\s+(?:ענו|ענתה|ענה|עונים|עונה)|אין\s+מענה|ואין\s+תשובה)|ניסיתי\s+(?:לחזור|להתקשר)\s+(?:אליה|אליו|אליכם|לנציגה)|התקשרתי\s+(?:חזרה|בחזרה)|(?:לא\s+(?:ענו|עונים|ענתה))\s+(?:לי\s+)?(?:כשהתקשרתי|כשחזרתי|בטלפון)/u;
const REP_MET_RE =
  /(?:כבר\s+)?קבענו|קבעתי\s+(?:איתה|איתו|אבחון|פגישה|מפגש)|נקבע(?:ה)?\s+(?:לנו\s+|לי\s+)?(?:פגישה|אבחון|מפגש)|יש\s+(?:לנו|לי)\s+(?:כבר\s+)?(?:פגישה|אבחון|מפגש)\s+(?:קבוע|קבועה|ב|מחר|ביום)/u;
const REP_TALKING_RE = new RegExp(
  [
    `(?:כבר\\s+)?(?:מדברים|מדברת|מדבר|דיברו|דיברתי|דיברנו|דיברה)\\s+(?:איתי|איתנו|איתה|איתו|עם\\s+(?:ה)?נציגה)`,
    `(?:היא|הנציגה|מישהי|מישהו|הוא|נציגה)\\s+(?:כבר\\s+)?(?:התקשרה|התקשר|חזרה|חזר|דיברה)(?:\\s+(?:אליי|אלי|אלינו|איתי))?`,
    `אני\\s+(?:איתה|איתו|עם\\s+(?:ה)?נציגה)\\s+(?:ב|על\\s+ה)?(?:טלפון|קו)`,
    `(?:חזרו|התקשרו)\\s+(?:אליי|אלי|אלינו)`,
    `${L}{2,12}\\s+(?:כבר\\s+)?(?:חזרה|התקשרה|חזר|התקשר)\\s+(?:אליי|אלי|אלינו)`,
  ].join("|"),
  "u"
);

/** "התקשרתי חזרה ולא ענו" / "ניסיתי לחזור אליה". Pure — tested. */
export function repCallbackMissed(raw: string): boolean {
  return REP_MISSED_RE.test(clean(raw));
}

/** "already talking to a rep" → "talking"; a meeting was set → "met"; else null. Pure — tested. */
export function alreadyWithRep(raw: string): "talking" | "met" | null {
  const t = clean(raw);
  if (!t || repCallbackMissed(t) || NEGATED_CONTACT_RE.test(t)) return null;
  const talking = REP_TALKING_RE.test(t);
  if (REP_MET_RE.test(t) && (talking || /קבענו|קבעתי|נקבע/u.test(t))) return "met";
  return talking ? "talking" : null;
}

export const WITH_REP_LINE = "מעולה, אז אתם כבר בידיים טובות 🙂 אם יעלה משהו, אני פה";
export const WITH_REP_MET_LINE = "מעולה, נתראה 🙂";
export const WITH_REP_DETAILS_ACK = "רשמתי, היא תראה את זה 🙏";
export const WITH_REP_LOG = "[וואטסאפ · בוט] הלקוח מדווח שהוא כבר בקשר עם נציגה";

export function repMissedLine(gender: Gender): string {
  return `אני מעדכן אותה עכשיו שתחזור ${gender === "f" ? "אלייך" : "אליך"}. מתי הכי נוח לך?`;
}

/** A message with a question in it (the bot answers it) vs. plain details (only the short ack). */
export function isQuestion(raw: string): boolean {
  return /\?|^(?:מה|איך|כמה|מתי|למה|האם|איפה|מי)\s/u.test(clean(raw));
}

// ─── 5. Who calls back: always "נציגת AllDog" ─────────────────────────────────

/**
 * "אני מעביר את הפנייה ישירות למאלף שיחזור אלייך" → "…לנציגת AllDog שתחזור אלייך"; "המאלף יחזור
 * אליך" → "נציגת AllDog תחזור אליך". The bot never promises that a trainer will call. Pure — tested.
 */
export function fixWhoCallsBack(text: string): string {
  const TRAINER = "(?:ה)?(?:מאלף|מאלפת|מאלפים)(?:\\s+(?:שלנו|המתאים|מתאים|מתאימה))?";
  return (
    text
      // "מעביר (את הפנייה) (ישירות) למאלף" → "מעביר (את הפנייה) לנציגת AllDog"
      .replace(new RegExp(`((?:מעביר|אעביר|העברתי|מעבירה)(?:\\s+את\\s+(?:ה)?(?:פנייה|פרטים|הכל|זה))?)\\s+(?:ישירות\\s+)?ל${TRAINER}`, "gu"), "$1 לנציגת AllDog")
      // "מעדכן את המאלף שיחזור" → "מעדכן את נציגת AllDog שתחזור"
      .replace(new RegExp(`((?:מעדכן|אעדכן|עדכנתי)\\s+את)\\s+${TRAINER}`, "gu"), "$1 נציגת AllDog")
      .replace(/(נציגת AllDog),?\s+שי(חזור|תקשר|צור)/gu, "$1 שת$2")
      // "(ה)מאלף יחזור / יתקשר / ייצור קשר" → "נציגת AllDog תחזור / תתקשר / תיצור קשר"
      .replace(new RegExp(`(^|[\\s,.(])${TRAINER}\\s+(?:כבר\\s+)?(?:יחזור|תחזור)`, "gu"), "$1נציגת AllDog תחזור")
      .replace(new RegExp(`(^|[\\s,.(])${TRAINER}\\s+(?:כבר\\s+)?(?:יתקשר|תתקשר)`, "gu"), "$1נציגת AllDog תתקשר")
      .replace(new RegExp(`(^|[\\s,.(])${TRAINER}\\s+(?:כבר\\s+)?(?:ייצור|יצור|תיצור)\\s+קשר`, "gu"), "$1נציגת AllDog תיצור קשר")
  );
}

// ─── 6. A price question gets the numbers ─────────────────────────────────────

/** The short price answer (item 37 §5 + Or 26/10 on the offset). */
export const PRICE_ANSWER_LINE =
  "שיחת הייעוץ בטלפון בחינם, ואבחון בבית עולה 350 ₪ ומתקזז אם ממשיכים לאילוף אינטנסיבי. אילוף אינטנסיבי ופנסיון: לפי אבחון.";

/** The reply to a price question must carry the diagnosis price — else the short answer opens it. Pure — tested. */
export function enforcePriceAnswer(reply: string): string {
  if (/350/.test(reply)) return reply;
  return reply.trim() ? `${PRICE_ANSWER_LINE}\n${reply.trim()}` : PRICE_ANSWER_LINE;
}
