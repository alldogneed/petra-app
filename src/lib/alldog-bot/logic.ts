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

export const MEDIA_REPLY = "היי , אני יודע לקרוא רק הודעות טקסט 🙂 נציגה תראה את ההודעה ותחזור אליך";

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
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\s*[—–]\s*/g, " , ")
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
