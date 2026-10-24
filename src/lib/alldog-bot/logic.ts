/**
 * AllDog WhatsApp bot — pure rules (no DB, no network). Unit-tested in
 * src/lib/__tests__/alldog-bot.test.ts.
 */

// ─── Inbound message classification ──────────────────────────────────────────

/** The subset of a Meta Cloud API inbound message we read. */
export interface MetaInboundMessage {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  audio?: { id?: string; mime_type?: string; voice?: boolean };
  voice?: { id?: string; mime_type?: string };
  group_id?: string;
  context?: { group_id?: string };
}

export type InboundKind =
  | { kind: "text"; text: string }
  | { kind: "voice"; mediaId: string; mimeType: string | null }
  | { kind: "media"; label: string }
  | { kind: "ignore"; reason: string };

const MEDIA_LABELS: Record<string, string> = {
  audio: "הודעה קולית",
  voice: "הודעה קולית",
  image: "תמונה",
  video: "סרטון",
  document: "מסמך",
  sticker: "סטיקר",
  location: "מיקום",
  contacts: "איש קשר",
};

/** Text → reply; media → gentle "I read text only"; groups / statuses / system / reactions → ignored. */
export function classifyInbound(m: MetaInboundMessage): InboundKind {
  if (!m.id || !m.from) return { kind: "ignore", reason: "malformed" };
  if (m.group_id || m.context?.group_id || m.from.includes("@g.us")) return { kind: "ignore", reason: "group" };
  if (m.from === "status@broadcast" || m.from.includes("broadcast")) return { kind: "ignore", reason: "status" };
  switch (m.type) {
    case "text": {
      const t = m.text?.body?.trim();
      return t ? { kind: "text", text: t.slice(0, 4000) } : { kind: "ignore", reason: "empty" };
    }
    case "button": {
      const t = m.button?.text?.trim();
      return t ? { kind: "text", text: t.slice(0, 500) } : { kind: "ignore", reason: "empty" };
    }
    case "interactive": {
      const t = (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title)?.trim();
      return t ? { kind: "text", text: t.slice(0, 500) } : { kind: "ignore", reason: "empty" };
    }
    case "audio":
    case "voice": {
      // Voice notes are transcribed (Or, item 28a); without a media id → the old "media" path.
      const media = m.audio ?? m.voice;
      if (media?.id) return { kind: "voice", mediaId: media.id, mimeType: media.mime_type ?? null };
      return { kind: "media", label: MEDIA_LABELS[m.type] };
    }
    default:
      if (m.type && MEDIA_LABELS[m.type]) return { kind: "media", label: MEDIA_LABELS[m.type] };
      return { kind: "ignore", reason: m.type ?? "unknown" }; // system, reaction, unsupported, …
  }
}

export const MEDIA_REPLY = "היי , אני יודע לקרוא רק הודעות טקסט 🙂 נציגה תראה את ההודעה ותחזור בטלפון";

// ─── Voice notes (Or, item 28a) ───────────────────────────────────────────────

/** WaBotMessage.text of a voice note until it is transcribed. */
export const VOICE_PENDING_TEXT = "[הודעה קולית]";
/** WaBotMessage.text of a voice note that could not be transcribed. */
export const VOICE_FAILED_TEXT = "[הודעה קולית: התמלול נכשל]";
/** The bot's answer when it could not transcribe — never "נציגה תראה את ההודעה" (Or). */
export const VOICE_FAILED_REPLY = "לא הצלחתי לשמוע את ההקלטה 🙏 אפשר לכתוב לי בקצרה?";

export function isVoicePending(row: { kind: string; text: string }): boolean {
  return row.kind === "voice" && row.text === VOICE_PENDING_TEXT;
}
export function isVoiceFailed(row: { kind: string; text: string }): boolean {
  return row.kind === "voice" && (row.text === VOICE_FAILED_TEXT || row.text === VOICE_PENDING_TEXT);
}

/**
 * What the customer said in a message: the text, or a voice note's transcript.
 * null = media / a voice note that was not transcribed.
 */
export function customerWords(row: { kind: string; text: string }): string | null {
  if (row.kind === "text") return row.text;
  if (row.kind === "voice" && !isVoiceFailed(row)) return row.text;
  return null;
}

/** A transcript as the model sees it in the history. */
export function voiceHistoryText(transcript: string): string {
  return `(הודעה קולית, תומללה) ${transcript}`;
}

/** The lead journal line of a voice note: the transcript + the WhatsApp media id of the recording. */
export function voiceNoteLogText(mediaId: string, transcript: string | null): string {
  const body = transcript ? `תמלול: "${transcript.slice(0, 1500)}"` : "התמלול נכשל, הבוט ביקש מהלקוח לכתוב בקצרה";
  return `[וואטסאפ · בוט] 🎤 הודעה קולית · ${body} · מזהה הקלטה ב-WhatsApp: ${mediaId}`;
}

/** Cleans a speech-to-text result; empty / audio-event only → null (= failed). */
export function cleanTranscript(text: string | null | undefined): string | null {
  const t = (text ?? "")
    .replace(/\([^)]*\)/g, " ") // "(מוזיקה)", "(צחוק)" — audio events
    .replace(/\s+/g, " ")
    .trim();
  return t.replace(/[\p{P}\s]/gu, "").length >= 2 ? t.slice(0, 4000) : null;
}

// ─── Attribution line from the website's prefilled message ───────────────────

export interface ParsedAttribution {
  source: string | null;
  page: string | null;
  /** The message without the attribution line. */
  text: string;
}

const ATTRIBUTION_RE = /\(\s*הגעתי דרך\s*:\s*([^()]*?)\s*\)\s*$/u;

/** "…(הגעתי דרך: גוגל · /guides/aggression)" → { source: "גוגל", page: "/guides/aggression" }. */
export function parseAttributionLine(text: string): ParsedAttribution {
  const m = text.match(ATTRIBUTION_RE);
  if (!m) return { source: null, page: null, text: text.trim() };
  const parts = m[1].split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean);
  return {
    source: parts[0]?.slice(0, 100) ?? null,
    page: parts.length > 1 ? parts.slice(1).join(" · ").slice(0, 300) : null,
    text: text.slice(0, m.index).trim(),
  };
}

// ─── Stop requests ───────────────────────────────────────────────────────────

const STOP_EXACT = new Set(["די", "די כבר", "די תודה", "תעצור", "תעצרי", "תעצרו", "עצור", "stop", "סטופ", "תפסיק", "תפסיקו"]);
const STOP_CONTAINS = [/לא\s+מעוניי(ן|נת|נים)/u, /תפסיק(ו)?\s+לשלוח/u, /תעצר(ו|י)?\s+(את\s+)?(ה)?בוט/u, /אל\s+תשלח(ו)?\s+לי/u];

/** "תעצור", "די", "לא מעוניין" (and close variants) → stop. "די" only as the whole message. */
export function isStopRequest(text: string): boolean {
  const norm = text.replace(/[!.,?…🙏🙂\s]+/gu, " ").trim().toLowerCase();
  if (STOP_EXACT.has(norm)) return true;
  return STOP_CONTAINS.some((re) => re.test(norm));
}

// ─── Silence rules ───────────────────────────────────────────────────────────

export type ConversationStatus = "active" | "handoff" | "stopped";

export const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Meta only delivers free text within 24h of the customer's last message. */
export function isWithin24hWindow(lastInboundAt: Date | null | undefined, now: Date = new Date()): boolean {
  return !!lastInboundAt && now.getTime() - lastInboundAt.getTime() < WINDOW_MS - 60_000; // 1 min margin
}

/** The bot speaks only in an active conversation, inside the 24h window. */
export function botMayReply(conv: { status: string; lastInboundAt: Date | null }, now: Date = new Date()): boolean {
  return conv.status === "active" && isWithin24hWindow(conv.lastInboundAt, now);
}

// ─── Debounce ────────────────────────────────────────────────────────────────

export const DEBOUNCE_MS = 6000;

/**
 * Wait for the quiet period, then continue only if `myMessageId` is still the latest
 * inbound message of the conversation (a newer one has its own run, which will answer both).
 */
export async function waitForQuiet(opts: {
  myMessageId: string;
  latestInboundId: () => Promise<string | null>;
  sleep: (ms: number) => Promise<void>;
  waitMs?: number;
}): Promise<boolean> {
  await opts.sleep(opts.waitMs ?? DEBOUNCE_MS);
  return (await opts.latestInboundId()) === opts.myMessageId;
}

// ─── Outgoing reply shaping ──────────────────────────────────────────────────

/** At most two WhatsApp messages: split on a blank line / newline, else at a sentence near the middle. */
export function splitReply(text: string, maxParts = 2): string[] {
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  let parts = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1 && clean.includes("\n")) parts = clean.split("\n").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1 && clean.length > 320) {
    const mid = Math.floor(clean.length / 2);
    const cuts = [...clean.matchAll(/[.?!🙂🐶🐾]\s+/gu)].map((m) => (m.index ?? 0) + m[0].length);
    const cut = cuts.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0];
    if (cut && cut > 40 && cut < clean.length - 20) parts = [clean.slice(0, cut).trim(), clean.slice(cut).trim()];
  }
  if (parts.length <= maxParts) return parts;
  return [...parts.slice(0, maxParts - 1), parts.slice(maxParts - 1).join("\n")];
}

/** "Typing…" pause before a message: 2–8 seconds by length. */
export function typingDelayMs(text: string): number {
  return Math.round(Math.min(8000, Math.max(2000, 1200 + text.length * 45)));
}

/** Last guard on what the model wrote: no em dashes, no markdown bold, no trailing period. */
export function polishReply(text: string): string {
  return fixHebrewSlips(text)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\s*[—–]\s*/g, " , ")
    // Or's playbook: never "אל דאגה" (the model still reaches for it).
    .replace(/(^|[\s,])אל דאגה\s*[,!.]?\s*/gu, "$1")
    .split("\n")
    .map((l) => l.replace(/\.\s*$/u, "").trimEnd())
    .join("\n")
    .trim();
}

/** Messages of a conversation → alternating user/assistant turns (consecutive same-role merged). */
export function toChatTurns(
  rows: Array<{ role: string; text: string }>
): Array<{ role: "user" | "assistant"; content: string }> {
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const r of rows) {
    const role: "user" | "assistant" = r.role === "assistant" || r.role === "human" ? "assistant" : "user";
    const text = r.role === "human" ? `[נציג/ה כתב/ה]: ${r.text}` : r.text;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += `\n${text}`;
    else out.push({ role, content: text });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

// ─── Hebrew slips (Or's test 24/10 12:58: "חודחודשיים", "נציגה … שתיצרו") ─────────────

const L = "\\p{L}";
const WORD_RE = new RegExp(`[${L}\\p{M}'׳״"-]+`, "gu");

/** "חודחודשיים" = a 3+ letter start written twice ("חוד" + "חודשיים"). */
function mergedStutter(word: string): string | null {
  const w = word.replace(/^[\p{P}]+|[\p{P}]+$/gu, "");
  for (let n = 3; n <= Math.floor(w.length / 2); n++) {
    const head = w.slice(0, n);
    const rest = w.slice(n);
    if (rest.startsWith(head) && rest.length >= n + 2) return rest;
  }
  return null;
}

export interface TextIssue {
  kind: "duplicate_word" | "merged_word" | "wrong_form" | "number_gender";
  text: string;
}

/** Wrong word forms that came back from the model (Or, item 28d): "מחטף" → "חוטף". */
const WRONG_FORMS: Array<[RegExp, string]> = [
  [/(?<![\p{L}])(ו|ש|וש)?מחטף(?![\p{L}])/gu, "$1חוטף"],
  [/(?<![\p{L}])(ו|ש|וש)?מחטפת(?![\p{L}])/gu, "$1חוטפת"],
];

/** Feminine number + masculine noun: "חמש חודשים" → "חמישה חודשים" (item 28d). */
const MASC_NUMBERS: Record<string, string> = {
  שלוש: "שלושה",
  ארבע: "ארבעה",
  חמש: "חמישה",
  שש: "שישה",
  שבע: "שבעה",
  תשע: "תשעה",
  עשר: "עשרה",
  שתי: "שני",
};
const MASC_NOUNS = "חודשים|שבועות|ימים|מפגשים|אימונים|שיעורים|טיולים|ילדים|כלבים|גורים";
const NUMBER_GENDER_RE = new RegExp(`(?<![\\p{L}])(ו|ה|וה|ב|ל|כ)?(${Object.keys(MASC_NUMBERS).join("|")})(\\s+)(${MASC_NOUNS})(?![\\p{L}])`, "gu");

/** Doubled words ("של של") and merged stutters ("חודחודשיים") — used by the tests and the simulator. */
export function findTextIssues(text: string): TextIssue[] {
  const issues: TextIssue[] = [];
  const words = text.match(WORD_RE) ?? [];
  for (let i = 0; i < words.length; i++) {
    if (i > 0 && words[i].length > 1 && words[i] === words[i - 1]) issues.push({ kind: "duplicate_word", text: `${words[i]} ${words[i]}` });
    if (mergedStutter(words[i])) issues.push({ kind: "merged_word", text: words[i] });
  }
  for (const [re] of WRONG_FORMS) for (const m of text.matchAll(re)) issues.push({ kind: "wrong_form", text: m[0] });
  for (const m of text.matchAll(NUMBER_GENDER_RE)) issues.push({ kind: "number_gender", text: m[0] });
  return issues;
}

/**
 * Deterministic fixes the model sometimes needs: a doubled word, a merged stutter, and verbs
 * that must agree with "נציגה" (feminine singular): "נציגה … שתיצרו קשר" → "שתיצור".
 */
export function fixHebrewSlips(text: string): string {
  let out = text
    // "של של" → "של" (same word twice in a row, single space between).
    .replace(new RegExp(`(^|[^${L}])([${L}]{2,})\\s+\\2(?=[^${L}]|$)`, "gu"), "$1$2")
    .replace(new RegExp(`[${L}]{8,}`, "gu"), (w) => mergedStutter(w) ?? w);
  for (const [re, to] of WRONG_FORMS) out = out.replace(re, to);
  out = out.replace(NUMBER_GENDER_RE, (_m, pre: string | undefined, num: string, sp: string, noun: string) => `${pre ?? ""}${MASC_NUMBERS[num]}${sp}${noun}`);
  // Within one sentence after נציגה / נציגת / הנציגה: the verb is feminine singular.
  out = out.replace(/(נציג[הת](?:[^.?!\n]{0,60}?\s)?)([שו]?)(?:יצרו|תיצרו|יצור)(?=\s|[,.?!]|$)/gu, "$1$2תיצור");
  out = out.replace(/(נציג[הת](?:[^.?!\n]{0,60}?\s)?)([שו]?)(?:יחזרו|תחזרו|יחזור)(?=\s|[,.?!]|$)/gu, "$1$2תחזור");
  return out;
}

// ─── Conversation-level guards (Or's test 24/10 12:58) ─────────────────────────────────

const PRAISE = "(?:שם\\s+(?:מקסים|יפה|מתוק|מהמם|חמוד|מושלם)|(?:אחלה|מעולה|מהמם|יפה|נהדר)\\s+גזע|גזע\\s+(?:מעולה|מהמם|יפה|מקסים|נהדר|מדהים)|מעולה|מקסים|מקסימה|יופי|נהדר|אחלה|איזה\\s+כיף)";
/** "יוקי , שם מקסים" / "גאולים , מעולה" — a short echo of what the customer said + a compliment. */
const MIRROR_RE = new RegExp(`^([^,.!?\\n]{1,30}?)\\s*,\\s*(?:איזה\\s+)?${PRAISE}\\s*[!.]*\\s*(?:🙂|🐶|🐾|😍)?\\s*`, "u");
/** "איזה שם מקסים !" on its own. */
const NAME_PRAISE_RE = /^(?:איזה\s+)?שם\s+(?:מקסים|יפה|מתוק|מהמם|חמוד|מושלם)\s*[!.]*\s*(?:🙂|🐶|🐾|😍)?\s*/u;

function praiseMatch(line: string): RegExpMatchArray | null {
  return line.match(NAME_PRAISE_RE) ?? line.match(MIRROR_RE);
}

/** How many echo + compliment openings a text has (one per line at most). */
export function countMirrorPraise(text: string): number {
  return text.split("\n").filter((l) => praiseMatch(l.trim())).length;
}

export const SURNAME_QUESTION_RE = /שם\s+(?:ה)?משפחה/u;

// ─── Item 26 (Or): no repeated bot message, no invented familiarity ────────────────────

/** Comparable form of a bot line: letters + digits only. */
function normLine(line: string): string {
  return line.replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Bot lines already sent in this conversation (normalized). */
function sentLines(priorBotTexts: string[]): Set<string> {
  const out = new Set<string>();
  for (const t of priorBotTexts) {
    out.add(normLine(t));
    for (const l of t.split(/\n+/)) out.add(normLine(l));
  }
  return out;
}

/** A bot message identical to an earlier bot message of the same conversation — never sent twice. */
export function isRepeatedMessage(text: string, priorBotTexts: string[]): boolean {
  const n = normLine(text);
  return n.length >= 6 && sentLines(priorBotTexts).has(n);
}

/** "מכירים את זה טוב" and friends: the bot does not know this dog / case — no invented familiarity. */
export const INVENTED_FAMILIARITY_RE = /(?<![\p{L}])(?:ו)?(?:אנחנו\s+)?מכירים(?![\p{L}])/u;
const FAMILIARITY_FIXES: Array<[RegExp, string]> = [
  [/(?<![\p{L}])(ו)?(?:אנחנו\s+)?מכירים\s+(?:את\s+)?(?:זה|הגזע(?:\s+הזה)?|המקרה(?:\s+הזה)?|הבעיה(?:\s+הזאת|\s+הזו)?|אותו|אותה|את\s+הסוג\s+הזה)(?:\s+(?:טוב|היטב|מצוין))?/gu, "$1שומעים על זה הרבה"],
  [/(?<![\p{L}])(ו)?(?:אנחנו\s+)?מכירים(?:\s+(?:טוב|היטב))?(?![\p{L}])/gu, "$1שומעים על זה הרבה"],
];

export function removeInventedFamiliarity(text: string): string {
  let out = text;
  for (const [re, to] of FAMILIARITY_FIXES) out = out.replace(re, to);
  return out;
}

// ─── Item 27 (Or's tests 24/10 14:41–15:02) ─────────────────────────────────────────────

/** The customer mentioned Tel Aviv — the only city where the neighbourhood is asked (27a). */
export const TEL_AVIV_RE = /תל[\s-]?אביב|(?<![\p{L}])ת["״׳']?א(?![\p{L}])|יפו/u;

/** The city question in any plural / combined form → the fixed singular one (27a + 27d). */
export function fixCityQuestion(line: string, telAviv: boolean): string {
  let out = line
    // "באיזו עיר ובאיזו שכונה אתם גרים ?" / "איפה אתם גרים ?" / "באיזו עיר אתם ?"
    .replace(/(?<![\p{L}])(?:ו)?(?:איפה|באיזו\s+עיר(?:\s+ו(?:באיזו\s+)?שכונה)?|באיזה\s+אזור)\s+(?:אתם|את|אתה)(?:\s+(?:גרים|גרה|גר|נמצאים|נמצאת|נמצא))?(?:\s+בדיוק)?\s*\?/gu, "באיזו עיר?")
    // "באיזו שכונה אתם גרים בתל אביב ?" → the Tel Aviv question
    .replace(/(?<![\p{L}])באיזו\s+שכונה(?:\s+(?:אתם|את|אתה))?(?:\s+(?:גרים|גרה|גר))?(?:\s+בתל\s+אביב)?\s*\?/gu, "באיזו שכונה בתל אביב?");
  if (!telAviv) {
    // Outside Tel Aviv the neighbourhood is never asked.
    out = out
      .replace(/(?<![\p{L}])עיר\s+ו(?:באיזו\s+|איזו\s+)?שכונה/gu, "עיר")
      .replace(/(?<![\p{L}])עיר\s+\+\s+שכונה/gu, "עיר");
  }
  return out;
}

/** Prices / routes: only when the customer asked (27c). */
export const PRICE_ASKED_RE = /כמה\s+(?:זה\s+)?(?:עולה|עולים|יעלה|כסף)|מחיר|עלות|תמחור|₪|שקל|כמה\s+זה(?![\p{L}])|מסלול|אינטנסיבי|שיעורים|פנסיון/u;
const PRICE_LINE_RE = /₪|\d{3}\s*ש["״]?ח|(?<![\p{L}])מחיר/u;
const GUIDE_LINK_RE = /https?:\/\/\S*all-dog\.co\.il\S*/u;

/** "אחלה, פתח תקווה באזור שלנו 🙂" — a short acknowledgement on its own line (27f). */
const FILLER_START_RE = /^(?:אחלה|מעולה|סבבה|מצוין|יופי|נהדר|טוב|אוקיי|אוקי|הבנתי|מושלם|בסדר גמור)(?![\p{L}])/u;
export function isFillerLine(line: string): boolean {
  const t = line.trim();
  if (!t || /\?/.test(t)) return false;
  const words = t.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean).length;
  return words <= 9 && (FILLER_START_RE.test(t) || /באזור\s+שלנו/u.test(t));
}

export interface GuardContext {
  /** The customer's messages so far (for prices / Tel Aviv). */
  userTexts?: string[];
  /** What the customer already gave — those questions are not asked again (29b). */
  known?: KnownFacts;
}

/**
 * Applied to every bot reply with the bot's earlier messages:
 *   a. no line the bot already sent in this conversation (item 26);
 *   b. at most ONE echo + compliment ("יוקי , שם מקסים", "רועה גרמני , אחלה גזע") in the whole
 *      conversation, and no invented familiarity ("מכירים את זה" → "שומעים על זה הרבה");
 *   27b. never a surname question (the name the customer gives is enough);
 *   27a/d. the city question is "באיזו עיר?" (neighbourhood only in Tel Aviv), never plural;
 *   27c. no price line unless the customer asked; the guide link at most once and never in the
 *        first reply;
 *   27f. no stand-alone filler line ("אחלה, פתח תקווה באזור שלנו 🙂") next to a real line.
 */
// ─── Item 29 (Or's test 24/10 16:13) ─────────────────────────────────────────

const NAME_PRAISE_WORDS =
  "(?:מקסים|יפה|יפהפה|מתוק|מהמם|חמוד|מושלם|חזק|מגניב|מיוחד|מעולה|נהדר|אדיר|מדהים|קלאסי|טוב|מצוין|מצויין|מקורי|מצחיק|שווה)";
const NAME_PRAISE_PARTS = [
  // "באלו , שם חזק !" / "באלו, איזה שם חזק 🙂" at the start of a line
  new RegExp(`^[^,.!?\\s]{1,15}(?:\\s+[^,.!?\\s]{1,15})?\\s*,\\s*(?:איזה\\s+)?שם\\s+${NAME_PRAISE_WORDS}(?:\\s+(?:יש\\s+(?:לו|לה)|לכלב|לכלבה))?\\s*[!.]*\\s*(?:🙂|🐶|🐾|😍|💪)?\\s*`, "u"),
  // "שם חזק !" / "איזה שם מקסים" anywhere
  new RegExp(`(?:^|[,.!]\\s*|\\s)(?:איזה\\s+)?שם\\s+${NAME_PRAISE_WORDS}(?:\\s+(?:יש\\s+(?:לו|לה)|לכלב|לכלבה))?\\s*[!.]*\\s*(?:🙂|🐶|🐾|😍|💪)?\\s*`, "gu"),
];

/** Removes a compliment on the dog's name (Or, item 29e). Pure — tested. */
export function stripNamePraise(line: string): string {
  let out = line;
  for (const re of NAME_PRAISE_PARTS) out = out.replace(re, (m) => (/^[,.!]/.test(m) ? " " : m.startsWith(" ") ? " " : ""));
  out = out.replace(/\s{2,}/g, " ").replace(/^\s*[,.]\s*/, "").trim();
  // "ובאיזו עיר ?" left after "באלו , שם חזק !" → "באיזו עיר ?"
  return out !== line.trim() ? out.replace(/^ו(?=(?:באיזו|באיזה|איך|איזה|איזו|מה|בן|בת|כמה|ממתי|מתי)(?![\p{L}]))/u, "") : out;
}

export interface KnownFacts {
  city?: boolean;
  dogName?: boolean;
}

/** A question about something the customer already gave → dropped / trimmed (29b). Pure — tested. */
export function dropKnownQuestion(line: string, known: KnownFacts): string {
  let out = line;
  if (known.city && /\?/.test(out) && /(?:באיזו|איזו)\s+עיר|באיזה\s+אזור|איפה\s+(?:את|אתה|אתם)\s+(?:גר|גרה|גרים)|מאיפה\s+(?:את|אתה|אתם)/u.test(out)) return "";
  if (known.dogName) {
    // "…, ואיך קוראים לכלב ?" → keep the rest; a line asking only the dog's name → dropped.
    out = out.replace(/\s*,?\s*ו?איך\s+קוראים\s+ל(?:ה)?כלב(?:ה)?\s*\?/u, " ?").replace(/\s+\?/g, " ?");
    if (/^\s*(?:ו)?(?:איך\s+קוראים\s+ל(?:ה)?כלב(?:ה)?|מה\s+(?:ה)?שם\s+(?:של\s+)?(?:ה)?כלב(?:ה)?)\s*\?\s*$/u.test(out)) return "";
  }
  return out.trim() === "?" ? "" : out;
}

const NOT_A_NAME = new Set(["אני", "אנחנו", "גר", "גרה", "גרים", "הוא", "היא", "כלב", "כלבה", "זה", "יש", "לא", "כן", "רק", "שלום", "היי"]);

/**
 * A short answer "<שם> מ<מקום>" ("באלו מקרני שומרון") = a name + the city (29b). Pure — tested.
 * Returns null when the text is anything else.
 */
export function parseNamePlace(text: string): { name: string; place: string } | null {
  const m = text.trim().match(/^([\p{L}'׳"״-]{2,15})\s+מ([\p{L}'׳"״-]{2,}(?:\s+[\p{L}'׳"״-]{2,}){0,2})\s*[.!🙂🐶🐾]*\s*$/u);
  if (!m || NOT_A_NAME.has(m[1])) return null;
  return { name: m[1], place: m[2].trim() };
}

/** The customer already said the city: answered a city question, or "<שם> מ<עיר>" (29b). Pure — tested. */
export function cityAlreadyGiven(rows: Array<{ role: string; text: string }>): boolean {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.role === "user" && parseNamePlace(r.text)) return true;
    if ((r.role === "assistant" || r.role === "bot") && /(?:באיזו|איזו)\s+עיר/u.test(r.text)) {
      const next = rows.slice(i + 1).find((x) => x.role === "user");
      if (next && next.text.trim().length >= 2) return true;
    }
  }
  return false;
}

/** Context note for "באלו מקרני שומרון" (29b). */
export function namePlaceNote(text: string): string | null {
  const p = parseNamePlace(text);
  if (!p) return null;
  return `הלקוח ענה "${text.trim()}": "${p.name}" הוא השם (שם הכלב, אם שם הבעלים כבר ידוע או לא נאמר) והעיר היא "${p.place}". שמור ב-save_lead (dog_name / city) ואל תשאל שוב לא את השם ולא את העיר.`;
}

/** An attack / bite in what the customer said → no "מעולה" in the closing (29c). */
const SERIOUS_RE = /(?:תוקף|תוקפת|תקף|תקפה|מתקיף|מתקיפה|נשך|נשכה|נושך|נושכת|נשיכה|נשיכות|תקיפה|מתנפל|מתנפלת|פצע|פציעה|דימם|תפרים)/u;
export function isSeriousIncident(texts: string[]): boolean {
  return texts.some((t) => SERIOUS_RE.test(t));
}

/** "מעולה ," / "אחלה ," / "יופי ," at the start of a line — dropped after an attack / bite (29c). */
export function dropCheerfulOpeners(text: string): string {
  return text
    .split("\n")
    .map((l) => l.replace(/^(\s*)(?:מעולה|אחלה|יופי|סבבה|מצוין|נהדר)\s*[,!.]?\s*(?:🙂|🙏)?\s*/u, "$1"))
    .join("\n");
}

/** Item 29d: "רק לוודא, השם הוא אור?" — the one confirmation of a name heard only in a voice note. */
export const NAME_CONFIRM_PREFIX = "רק לוודא, השם הוא ";

/**
 * The name the bot knows came only from a voice note (not typed, not the WhatsApp profile) and was
 * not confirmed → the first name to keep out of the address; null = the name may be used. Pure — tested.
 */
export function voiceOnlyName(opts: {
  name: string | null;
  typedTexts: string[];
  voiceTexts: string[];
  profileName?: string | null;
  priorBotTexts: string[];
}): string | null {
  const first = (opts.name ?? "").trim().split(/\s+/)[0];
  if (!first || first.length < 2) return null;
  const has = (t: string | null | undefined) => !!t && new RegExp(`(?:^|[^\\p{L}])${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").test(t);
  if (opts.typedTexts.some(has) || has(opts.profileName)) return null;
  if (!opts.voiceTexts.some(has)) return null;
  const asked = opts.priorBotTexts.some((t) => t.includes(`${NAME_CONFIRM_PREFIX}${first}`));
  if (asked && opts.typedTexts.some((t) => /^(?:כן|נכון|בדיוק|כ+ן|יס|yes)(?![\p{L}])/iu.test(t.trim()))) return null;
  return first;
}

/** Context note for a name heard only in a voice note (29d). */
export function voiceNameNote(first: string, priorBotTexts: string[]): string {
  const asked = priorBotTexts.some((t) => t.includes(NAME_CONFIRM_PREFIX));
  return asked
    ? `השם "${first}" נשמע רק בהודעה קולית ועוד לא אושר: לא פונים אל הלקוח בשם.`
    : `השם "${first}" נשמע רק בהודעה קולית (התמלול יכול לטעות): לא פונים אל הלקוח בשם. אם צריך, מאשרים פעם אחת בלבד: "${NAME_CONFIRM_PREFIX}${first}?"`;
}

/** "<שם> ," / ", <שם> ?" as an address → removed (29d); the confirmation question stays. Pure — tested. */
export function stripVocativeName(text: string, first: string | null): string {
  if (!first) return text;
  const n = first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .split("\n")
    .map((l) =>
      l.includes(NAME_CONFIRM_PREFIX)
        ? l
        : l
            .replace(new RegExp(`^(\\s*)(?:היי\\s+|שלום\\s+)?${n}\\s*,\\s*`, "u"), "$1")
            .replace(new RegExp(`\\s*,\\s*${n}(?=\\s*(?:[?!.🙂🙏]|$))`, "gu"), "")
    )
    .join("\n");
}

export function applyConversationGuards(reply: string, priorBotTexts: string[], ctx: GuardContext = {}): string {
  const userTexts = ctx.userTexts ?? [];
  let praiseLeft = Math.max(0, 1 - priorBotTexts.reduce((n, t) => n + countMirrorPraise(t), 0));
  const sent = sentLines(priorBotTexts);
  const telAviv = userTexts.some((t) => TEL_AVIV_RE.test(t));
  const priceAsked = userTexts.some((t) => PRICE_ASKED_RE.test(t));
  const linkSent = priorBotTexts.some((t) => GUIDE_LINK_RE.test(t));
  const firstReply = priorBotTexts.length === 0;

  const lines = removeInventedFamiliarity(reply).split("\n").map((raw) => {
    let line = raw.trim();
    if (!line) return raw;
    // 29e. never a compliment on the dog's name ("באלו , שם חזק").
    line = stripNamePraise(line);
    if (!line) return null;
    line = fixCityQuestion(line, telAviv);
    // 29b. never ask again what the customer already said.
    line = dropKnownQuestion(line, ctx.known ?? {});
    if (!line) return null;
    // a. a line the bot already sent in this conversation is not sent again.
    const n = normLine(line);
    if (n.length >= 6 && sent.has(n)) return null;
    if (SURNAME_QUESTION_RE.test(line) && /\?/.test(line)) return null;
    if (!priceAsked && PRICE_LINE_RE.test(line)) return null;
    if ((linkSent || firstReply) && GUIDE_LINK_RE.test(line)) return null;
    const m = praiseMatch(line);
    if (!m) return line;
    if (praiseLeft > 0) {
      praiseLeft--;
      return line;
    }
    return line.slice(m[0].length).trim() || null;
  });
  const kept = lines.filter((l): l is string => l !== null);
  // f. a filler line only goes out when it is all there is.
  const real = kept.filter((l) => l.trim() && !isFillerLine(l));
  const out = real.length ? kept.filter((l) => !l.trim() || !isFillerLine(l)) : kept;
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ─── Urgency (Or's test 24/10 12:58: "דחוף" / "בהקדם" / "השכנים מתלוננים") ─────────────

const URGENCY_RULES: Array<[RegExp, string]> = [
  [/השכנים\s+(?:כבר\s+)?(?:מתלוננים|התלוננו|מאיימים|איימו)|תלונ(?:ה|ות)\s+(?:של|מ)?(?:ה)?שכנים|ועד\s+הבית|תלונה\s+(?:ל|ב)?(?:ה)?עירייה|פיקוח\s+(?:ה)?עירוני/u, "השכנים מתלוננים"],
  [/(?:נאלץ|נאלצים|נצטרך|נאלצת|שוקלים|חושבים)\s+(?:ל)?(?:מסור|למסור|לוותר\s+עליו|לוותר\s+עליה|להחזיר\s+(?:אותו|אותה))/u, "שוקלים למסור את הכלב"],
  [/דחוף|בדחיפות/u, "הלקוח כתב שזה דחוף"],
  [/בהקדם|כמה\s+שיותר\s+מהר|מהר\s+ככל\s+ה?אפשר|אין\s+לנו\s+זמן|אין\s+לי\s+זמן|עוד\s+היום|ASAP/iu, "הלקוח ביקש בהקדם"],
];

/**
 * The customer says it is urgent → why (Hebrew, for the lead note), else null.
 * "לא דחוף" / "לא בוער" do not count.
 */
export function urgencyReason(text: string): string | null {
  const t = text.replace(/\s+/g, " ");
  if (/לא\s+(?:כל\s+כך\s+|ממש\s+)?(?:דחוף|בוער)/u.test(t) && !URGENCY_RULES.slice(0, 2).some(([re]) => re.test(t))) return null;
  for (const [re, reason] of URGENCY_RULES) if (re.test(t)) return reason;
  return null;
}

export const URGENT_NOTE_PREFIX = "[וואטסאפ · בוט] ⚠ דחוף";
