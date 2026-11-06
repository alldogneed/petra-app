/**
 * Customer replies to Petra's automatic WhatsApp messages — pure rules (tests:
 * src/lib/__tests__/whatsapp-inbound.test.ts). DB side: src/lib/whatsapp-inbound.ts.
 *
 * 3/11/2026: an AllDog customer answered a reminder that said "אין להשיב להודעה זו" to cancel her
 * meeting (a funeral). The platform webhook only acknowledged inbound messages, so nobody saw it.
 * Now a reply that reaches the PLATFORM number becomes a task + bell in the business that messaged
 * that phone, and the customer gets one short acknowledgement (inside the 24h window it just opened).
 */

export interface InboundMessage {
  /** Meta's id of the inbound message (dedupe key). */
  id: string;
  /** Sender, WhatsApp digits ("9725…"). */
  from: string;
  /** What the customer wrote (or a label for media). */
  text: string;
  /** The wamid of OUR message the customer swiped-replied to, when present. */
  repliedToWamid: string | null;
  /** Sent at (Meta's unix timestamp). */
  at: Date;
}

const MEDIA_LABELS: Record<string, string> = {
  image: "(הלקוח שלח תמונה)",
  audio: "(הלקוח שלח הודעה קולית)",
  voice: "(הלקוח שלח הודעה קולית)",
  video: "(הלקוח שלח סרטון)",
  document: "(הלקוח שלח קובץ)",
  sticker: "(הלקוח שלח מדבקה)",
  location: "(הלקוח שלח מיקום)",
  contacts: "(הלקוח שלח איש קשר)",
};

type RawMessage = {
  id?: unknown;
  from?: unknown;
  timestamp?: unknown;
  type?: unknown;
  text?: { body?: unknown };
  button?: { text?: unknown };
  interactive?: { button_reply?: { title?: unknown }; list_reply?: { title?: unknown } };
  image?: { caption?: unknown };
  video?: { caption?: unknown };
  document?: { caption?: unknown };
  context?: { id?: unknown };
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * `value.messages` of a Meta webhook change → the messages worth handling. Reactions, "system"
 * and unsupported messages are skipped (a 👍 reaction to a reminder is not a request). Pure.
 */
export function parseInboundMessages(raw: unknown): InboundMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: InboundMessage[] = [];
  for (const m of raw as RawMessage[]) {
    const id = str(m?.id);
    const from = str(m?.from).replace(/\D/g, "");
    const type = str(m?.type);
    if (!id || from.length < 9 || !type || ["reaction", "system", "unsupported", "ephemeral"].includes(type)) continue;
    let text = "";
    if (type === "text") text = str(m.text?.body);
    else if (type === "button") text = str(m.button?.text);
    else if (type === "interactive") text = str(m.interactive?.button_reply?.title) || str(m.interactive?.list_reply?.title);
    else if (MEDIA_LABELS[type]) {
      const caption = str(m.image?.caption) || str(m.video?.caption) || str(m.document?.caption);
      text = caption ? `${MEDIA_LABELS[type]} ${caption}` : MEDIA_LABELS[type];
    }
    text = text.replace(/\s+/g, " ").trim().slice(0, 1000);
    if (!text) continue;
    const ts = Number(str(m.timestamp));
    out.push({
      id,
      from,
      text,
      repliedToWamid: str(m.context?.id) || null,
      at: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : new Date(),
    });
  }
  return out;
}

/** "9725…" → the forms a phone is stored in ("9725…", "+9725…", "05…"). Pure. */
export function phoneVariants(waDigits: string): string[] {
  const d = waDigits.replace(/\D/g, "");
  const local = d.startsWith("972") ? `0${d.slice(3)}` : d;
  return [...new Set([d, `+${d}`, local])];
}

/** "9725…" → "05…" for display inside the business. */
export function localPhone(waDigits: string): string {
  const d = waDigits.replace(/\D/g, "");
  return d.startsWith("972") ? `0${d.slice(3)}` : d;
}

/**
 * Cancel / postpone ("לבטל", "לדחות", "לא אוכל להגיע", "נצטרך להזיז") → the task is HIGH. Pure.
 */
export function looksLikeCancellation(text: string): boolean {
  const t = text.replace(/\s+/g, " ");
  return /(?:^|[^\p{L}])(?:ל|נ|א|ת)?(?:בטל|ביטול|מבטל|מבטלת|לבטל|נבטל|אבטל)|(?:ל|נ|א|ת)?(?:דחות|דחייה|לדחות|נדחה|אדחה)|להזיז|נזיז|אזיז|לשנות\s+(?:את\s+)?(?:ה)?(?:מועד|תור|פגישה|שעה)|(?:לא|לצערי\s+לא)\s+(?:אוכל|נוכל|יכול|יכולה|יכולים|אגיע|נגיע|נצליח|אצליח)|(?:אני|אנחנו)\s+לא\s+(?:מגיע|מגיעה|מגיעים|יכול|יכולה|יכולים)|cancel|reschedule|can'?t\s+make\s+it/iu.test(t);
}

/** "תודה" / "אוקיי" / "👍" / "סבבה" alone — no task, no bell, no reply. Pure. */
export function isAckOnly(text: string): boolean {
  const t = text.replace(/[\s\p{P}]+/gu, " ").trim();
  if (!t) return true;
  if (/^[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️\s]+$/u.test(t)) return true;
  return /^(?:תודה(?:\s+רבה)?|תודה\s+לך|תודות|אוקיי?|אוקי|אוקיי\s+תודה|ok|okay|סבבה|מעולה|יופי|אחלה|קיבלתי|thanks|thank\s+you)(?:\s+(?:תודה|רבה|🙏|😊|🙂))*$/iu.test(t);
}

export const INBOUND_TASK_PREFIX = "הלקוח ענה להודעה האוטומטית";

/** The task title: "הלקוח ענה להודעה האוטומטית: <טקסט>" (≤ 140 chars). Pure. */
export function inboundTaskTitle(text: string, name: string | null): string {
  const who = name ? ` (${name})` : "";
  const room = Math.max(20, 140 - INBOUND_TASK_PREFIX.length - who.length - 4);
  const quote = text.length > room ? `${text.slice(0, room - 1)}…` : text;
  return `${INBOUND_TASK_PREFIX}${who}: ${quote}`;
}

/** The line that marks a task's phone, so later messages are appended to it. */
export function inboundPhoneLine(waDigits: string): string {
  return `טלפון: ${localPhone(waDigits)}`;
}

/** One line per message in the task description. */
export function inboundMessageLine(at: Date, text: string): string {
  const hhmm = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  return `${hhmm} · ${text}`;
}

/** The customer's acknowledgement — free text, sent only right after they wrote (24h window). */
export function autoReplyText(businessName: string | null, contactPhone: string | null): string {
  const who = businessName?.trim() ? `${businessName.trim()} יחזרו אליך בהקדם` : "העסק יחזור אליך בהקדם";
  const phone = contactPhone?.trim() ? ` לפניות ישירות: ${contactPhone.trim()}` : "";
  return `תודה, קיבלנו את ההודעה 🙏 ${who}.${phone}`;
}

export interface AttributionCandidate {
  businessId: string | null;
  toPhone: string;
  phoneNumberId: string | null;
  createdAt: Date;
  wamid: string;
}

/** How far back the "last message we sent this phone" may be. */
export const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Which business a reply belongs to (pure):
 *   1. the exact message the customer replied to (`context.id`), when it was sent to THIS phone;
 *   2. else the most recent message we sent this phone in the last 30 days.
 * Only messages sent from the platform number count (`phoneNumberId` null = legacy platform sends,
 * or the platform id). null = no business — the reply is logged and dropped, never guessed.
 */
export function chooseAttribution(input: {
  from: string;
  platformPhoneNumberId: string | null;
  repliedTo: AttributionCandidate | null;
  recent: AttributionCandidate[];
  now: Date;
}): { businessId: string; wamid: string; via: "reply" | "recent" } | null {
  const variants = new Set(phoneVariants(input.from));
  const fromPlatform = (c: AttributionCandidate) => !c.phoneNumberId || c.phoneNumberId === input.platformPhoneNumberId;
  const r = input.repliedTo;
  if (r && r.businessId && variants.has(r.toPhone) && fromPlatform(r)) return { businessId: r.businessId, wamid: r.wamid, via: "reply" };
  const latest = input.recent
    .filter((c) => c.businessId && variants.has(c.toPhone) && fromPlatform(c) && input.now.getTime() - c.createdAt.getTime() <= ATTRIBUTION_WINDOW_MS)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return latest?.businessId ? { businessId: latest.businessId, wamid: latest.wamid, via: "recent" } : null;
}

/** Messages within this window after a task was opened are appended to it (one task per conversation). */
export const APPEND_WINDOW_MS = 60 * 60 * 1000;
/** At most one acknowledgement per phone per hour. */
export const AUTO_REPLY_THROTTLE_SECONDS = 60 * 60;
