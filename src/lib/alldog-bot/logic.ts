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
  group_id?: string;
  context?: { group_id?: string };
}

export type InboundKind =
  | { kind: "text"; text: string }
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
    default:
      if (m.type && MEDIA_LABELS[m.type]) return { kind: "media", label: MEDIA_LABELS[m.type] };
      return { kind: "ignore", reason: m.type ?? "unknown" }; // system, reaction, unsupported, …
  }
}

export const MEDIA_REPLY = "היי , אני יודע לקרוא רק הודעות טקסט 🙂 נציגה תראה את ההודעה ותחזור בטלפון";

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
  kind: "duplicate_word" | "merged_word";
  text: string;
}

/** Doubled words ("של של") and merged stutters ("חודחודשיים") — used by the tests and the simulator. */
export function findTextIssues(text: string): TextIssue[] {
  const issues: TextIssue[] = [];
  const words = text.match(WORD_RE) ?? [];
  for (let i = 0; i < words.length; i++) {
    if (i > 0 && words[i].length > 1 && words[i] === words[i - 1]) issues.push({ kind: "duplicate_word", text: `${words[i]} ${words[i]}` });
    if (mergedStutter(words[i])) issues.push({ kind: "merged_word", text: words[i] });
  }
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
  // Within one sentence after נציגה / נציגת / הנציגה: the verb is feminine singular.
  out = out.replace(/(נציג[הת](?:[^.?!\n]{0,60}?\s)?)([שו]?)(?:יצרו|תיצרו|יצור)(?=\s|[,.?!]|$)/gu, "$1$2תיצור");
  out = out.replace(/(נציג[הת](?:[^.?!\n]{0,60}?\s)?)([שו]?)(?:יחזרו|תחזרו|יחזור)(?=\s|[,.?!]|$)/gu, "$1$2תחזור");
  return out;
}

// ─── Conversation-level guards (Or's test 24/10 12:58) ─────────────────────────────────

const PRAISE = "(?:שם\\s+(?:מקסים|יפה|מתוק|מהמם|חמוד|מושלם)|מעולה|מקסים|מקסימה|יופי|נהדר|אחלה|איזה\\s+כיף)";
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

/**
 * Applied to every bot reply with the bot's earlier messages:
 *   b. at most ONE echo + compliment ("יוקי , שם מקסים") in the whole conversation;
 *   a. "ומה שם המשפחה …?" is asked once — never again, answered or not.
 */
export function applyConversationGuards(reply: string, priorBotTexts: string[]): string {
  let praiseLeft = Math.max(0, 1 - priorBotTexts.reduce((n, t) => n + countMirrorPraise(t), 0));
  const surnameAsked = priorBotTexts.some((t) => SURNAME_QUESTION_RE.test(t));
  const lines = reply.split("\n").map((raw) => {
    const line = raw.trim();
    if (!line) return raw;
    if (surnameAsked && SURNAME_QUESTION_RE.test(line) && /\?/.test(line)) return null;
    const m = praiseMatch(line);
    if (!m) return raw;
    if (praiseLeft > 0) {
      praiseLeft--;
      return raw;
    }
    return line.slice(m[0].length).trim() || null;
  });
  return lines.filter((l): l is string => l !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();
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
