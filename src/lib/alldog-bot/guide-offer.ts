/**
 * AllDog WhatsApp bot — offer the guide instead of sending it (Or, item 39 addition, 27/10).
 *
 *   lookup_guide found a guide that fits the problem precisely (preciseGuideFor) → remembered on
 *   the conversation (system row "guide_match") → once the basics are in (the closing was sent, or
 *   the lead has a city + the dog's name) the bot OFFERS it once, in its own short message
 *   (guideOfferText, 2–3 wordings, by gender) → "כן" / "בטח" / "שלח" / 👍 → the link + one line on
 *   what is in it (guideLinkMessage); anything else → never offered again.
 *   The customer asks for something to read → the link is sent right away, no offer.
 * The model itself never sends a guide link any more (stripGuideLinks); tool links (/guides/tools,
 * e.g. the chocolate calculator in an emergency) are left alone.
 */
import prisma from "@/lib/prisma";
import type { Gender } from "@/lib/alldog-bot/address";
import { KNOWLEDGE, searchKnowledge, normalizeHe, primaryProblemSlugs, tokens, type KnowledgeEntry } from "@/lib/alldog-bot/knowledge";

export const GUIDE_MATCH_KIND = "guide_match";
export const GUIDE_OFFER_KIND = "guide_offer";
/** The bot's offer message (role assistant) — not a question the reminder (nudge) chases. */
export const GUIDE_OFFER_MESSAGE_KIND = "guide_offer";
export const GUIDE_LINK_MESSAGE_KIND = "guide_link";

/** Too general to be "the guide for this problem". */
const GENERAL_SLUGS = new Set(["dog-behavior-problems"]);

/** Final letters as regular ones ("מושך" ~ "מושכת"). */
const unfinal = (w: string) => w.replace(/ך/g, "כ").replace(/ם/g, "מ").replace(/ן/g, "נ").replace(/ף/g, "פ").replace(/ץ/g, "צ");

function sameWord(rawA: string, rawB: string): boolean {
  const a = unfinal(rawA);
  const b = unfinal(rawB);
  if (a === b) return true;
  const [x, y] = a.length <= b.length ? [a, b] : [b, a];
  return x.length >= 3 && y.startsWith(x) && y.length - x.length <= 3;
}

/**
 * The guide's own wording covers the problem: one of its keyword phrases shares ≥ 2 real words
 * with the topic ("מושכת ברצועה" ~ "מושך ברצועה"). One shared word ("אוכל", "הזמן") is not enough.
 */
function keywordFits(topic: string, entry: KnowledgeEntry): boolean {
  const q = tokens(topic);
  return entry.keywords.some((k) => {
    // Each real word of the keyword counts once (tokens() also adds the word without its prefix).
    const words = normalizeHe(k).split(" ").map((w) => tokens(w)).filter((t) => t.length);
    const hits = words.filter((forms) => forms.some((f) => q.some((w) => sameWord(w, f)))).length;
    return words.length > 0 && hits >= Math.min(2, words.length);
  });
}

/** The one guide that fits the topic precisely, or null (no guide / only a loose match / a tool). Pure — tested. */
export function preciseGuideFor(topic: string, entries: KnowledgeEntry[] = KNOWLEDGE.entries): KnowledgeEntry | null {
  const matches = searchKnowledge(topic, entries, 2);
  const primary = primaryProblemSlugs(topic);
  const top = matches[0]?.score ?? 0;
  for (const m of matches) {
    if (m.score < top * 0.9) break; // only the best (or a tie)
    if (m.entry.kind !== "guide" || GENERAL_SLUGS.has(m.entry.slug)) continue;
    if (primary.includes(m.entry.slug) || keywordFits(topic, m.entry)) return m.entry;
  }
  return null;
}

export function guideBySlug(slug: string, entries: KnowledgeEntry[] = KNOWLEDGE.entries): KnowledgeEntry | null {
  return entries.find((e) => e.slug === slug && e.kind === "guide") ?? null;
}

function stableIndex(seed: string, n: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return n ? h % n : 0;
}

/** The offer, in its own short message — 3 wordings, singular by gender, picked by the conversation id. */
export function guideOfferText(gender: Gender, seed: string): string {
  const meet = gender === "f" ? "עד שתיפגשי עם מאלף" : gender === "m" ? "עד שתיפגש עם מאלף" : "עד הפגישה עם המאלף";
  const variants = [
    `יש מאמר מעולה שמאלף מהצוות שלנו כתב בדיוק על זה, אולי יעזור לך. לשלוח לך פה? שיהיה לך בינתיים ${meet}`,
    `מאלף מהצוות שלנו כתב מאמר בדיוק על זה. לשלוח לך לקרוא בינתיים, ${meet}?`,
    `יש לנו מדריך שאחד המאלפים שלנו כתב בדיוק על המצב הזה. רוצה שאשלח לך אותו פה, שיהיה לך ${meet}?`,
  ];
  return variants[stableIndex(seed, variants.length)];
}

/** The link after a "yes" (or a request to read): one line on what is in it + the URL. */
export function guideLinkMessage(entry: KnowledgeEntry): string {
  const line = (entry.insights[0] ?? entry.topic).replace(/\s+,/g, ",").replace(/[.\s]+$/u, "").trim();
  return `הנה 🙂 ${line}\n${entry.url}`;
}

const YES_RE = /^(?:כן|בטח|ברור|בשמחה|אשמח|יאללה|שלח|שלחי|תשלח|תשלחי|תשלחו|שלחו|כמובן|למה לא|👍|👌)(?![\p{L}])/iu;
/** Words that are a yes only as the whole message ("אפשר" can open a new question). */
const WEAK_YES_RE = /^(?:אפשר|בבקשה|סבבה|אוקיי|אוקי|ok|okay|יס|טוב|נשמע טוב|מעולה|🙏)$/iu;

/** The customer said yes to the offer ("כן", "בטח", "שלח", 👍…). Pure — tested. */
export function isYesToOffer(text: string): boolean {
  const t = text.replace(/[!.,?]+/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (/^(?:לא|אין צורך|לא צריך|לא תודה|תודה,? לא)(?![\p{L}])/u.test(t)) return false;
  return YES_RE.test(t) || WEAK_YES_RE.test(t) || /^👍+$/u.test(t);
}

/** "Yes" and nothing else (then no model turn is needed). */
export function isOnlyYes(text: string): boolean {
  return isYesToOffer(text) && text.replace(/[\p{P}\p{Extended_Pictographic}‍️]/gu, " ").trim().split(/\s+/).filter(Boolean).length <= 3;
}

/** The customer asks for something to read ("יש משהו לקרוא?", "תשלח לי מאמר"). Pure — tested. */
export function asksForReading(text: string): boolean {
  return /(?:משהו|חומר|מאמר|מדריך|כתבה)\s*(?:ל|כדי ל)?קרוא|חומר\s+קריאה|(?:תשלח|תשלחי|תשלחו|שלח|שלחי|יש|יש לכם|אפשר|אפשרי)\s+(?:לי\s+)?(?:\S+\s+){0,2}?(?:מאמר|מדריך|חומר|משהו לקרוא)/u.test(text);
}

export type OfferState = { slug: string; status: "pending" | "accepted" | "declined" | "sent" };

export async function readOffer(conversationId: string): Promise<{ id: string; state: OfferState } | null> {
  const row = await prisma.waBotMessage.findFirst({ where: { conversationId, role: "system", kind: GUIDE_OFFER_KIND }, select: { id: true, text: true } });
  if (!row) return null;
  try {
    return { id: row.id, state: JSON.parse(row.text) as OfferState };
  } catch {
    return null;
  }
}

/** Claim the one offer of the conversation (unique waMessageId) — false = already offered / sent. */
export async function claimOffer(conversationId: string, state: OfferState): Promise<boolean> {
  try {
    await prisma.waBotMessage.create({
      data: { conversationId, role: "system", kind: GUIDE_OFFER_KIND, text: JSON.stringify(state), waMessageId: `guide-offer:${conversationId}` },
    });
    return true;
  } catch {
    return false;
  }
}

export async function setOfferStatus(rowId: string, state: OfferState): Promise<void> {
  await prisma.waBotMessage.update({ where: { id: rowId }, data: { text: JSON.stringify(state) } }).catch(() => {});
}

/** Remember the precise guide of this conversation (latest wins). */
export async function rememberGuide(conversationId: string, slug: string): Promise<void> {
  const key = `guide-match:${conversationId}`;
  await prisma.waBotMessage
    .upsert({
      where: { waMessageId: key },
      create: { conversationId, role: "system", kind: GUIDE_MATCH_KIND, text: slug, waMessageId: key },
      update: { text: slug },
    })
    .catch(() => {});
}

export async function rememberedGuide(conversationId: string): Promise<KnowledgeEntry | null> {
  const row = await prisma.waBotMessage.findFirst({ where: { conversationId, role: "system", kind: GUIDE_MATCH_KIND }, select: { text: true } });
  return row ? guideBySlug(row.text) : null;
}

/** Guide links the model wrote are removed (+ the "כתבנו על זה מדריך:" intro). Tool links stay. Pure — tested. */
export function stripGuideLinks(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const out = line
        .replace(/(?:כתבנו על זה מדריך|יש לנו מדריך(?: על זה)?|מדריך שכתבנו)\s*:?\s*https?:\/\/(?:www\.)?all-dog\.co\.il\/guides\/(?!tools\/)\S*/gu, "")
        .replace(/https?:\/\/(?:www\.)?all-dog\.co\.il\/guides\/(?!tools\/)\S*/gu, "")
        .trimEnd();
      // A line that held only the link disappears (no empty line left behind).
      return out.trim() || !line.trim() ? out : null;
    })
    .filter((line): line is string => line !== null && !/^\s*(?:כתבנו על זה מדריך|יש לנו מדריך(?: על זה)?)\s*:?\s*$/u.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
