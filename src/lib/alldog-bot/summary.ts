/**
 * AllDog WhatsApp bot — one summary per conversation in the lead journal (Or, item 27i).
 *
 * When a conversation ends (closing message / handoff, or 30 minutes without a message) Claude
 * writes ONE short summary — the same shape as a PayCall call summary:
 *   [וואטסאפ · בוט] סיכום שיחה (24/10 15:02)
 *   כלב: יוקי · רועה גרמני · בן 3 · עיר: תל אביב (פלורנטין)
 *   בעיה: … · דחיפות: …
 *   הובטח: … · הצעד הבא: …
 * It lives in the conversation's ONE CallLog (`WaBotConversation.summaryCallLogId`), updated in
 * place — never a line per message. Idempotent per last message (`claimOnce`).
 */
import prisma from "@/lib/prisma";
import { claimOnce, releaseClaim } from "@/lib/rate-limit";
import { maskPhone } from "@/lib/whatsapp-failure";
import { israelParts } from "@/lib/alldog/time";
import { createDbExecutor, updateConversationLog, type BotConversationRef } from "@/lib/alldog-bot/actions";
import { currentSession, customerWords, parseImageMessageText, seemsMinor } from "@/lib/alldog-bot/logic";
import { MINOR_FACT, withBody, withFact } from "@/lib/alldog-bot/journal";
import { withControlLines } from "@/lib/alldog-bot/reply-hygiene";
import { alertAllDogFailure } from "@/lib/alldog/failure-alerts";

const LOG = "[alldog-bot:summary]";

/** A conversation with no message for this long is summarized by the cron. */
export const IDLE_SUMMARY_MS = 30 * 60 * 1000;
// The schema, the prompt, the Claude call and the journal text live in the shared summary core
// (src/lib/alldog/summary-core.ts) — the voice agent's call summary uses the same code.
export {
  BOT_SUMMARY_JSON_SCHEMA,
  SUMMARY_HEADER,
  formatBotSummary,
  isPuppyAge,
  parseBotSummary,
  puppyLine,
  type BotSummary,
} from "@/lib/alldog/summary-core";
import { formatBotSummary, summarizeConversation, type BotSummary } from "@/lib/alldog/summary-core";

/**
 * Item 39: one line per photo the customer sent ("תמונה מהלקוח: כלבה בינונית, נראית מעורבת"),
 * max 3, under the summary. Pure — tested.
 */
export function imageSummaryLines(rows: Array<{ role: string; kind: string; text: string }>): string[] {
  return rows
    .filter((r) => r.role === "user" && r.kind === "image")
    .map((r) => parseImageMessageText(r.text).description)
    .filter((d): d is string => !!d)
    .slice(-3)
    .map((d) => `תמונה מהלקוח: ${d}`);
}

function dateLabel(d: Date): string {
  const p = israelParts(d);
  return `${p.ymd.slice(8, 10)}/${p.ymd.slice(5, 7)} ${p.hhmm}`;
}

type ConvRow = {
  id: string;
  businessId: string;
  phone: string;
  profileName: string | null;
  leadId: string | null;
  summaryCallLogId: string | null;
  attributionSource: string | null;
  attributionPage: string | null;
};

/**
 * Summarize one conversation into its ONE CallLog. `claim` = only once per last message (the
 * closing path and the idle cron share the key). Never throws.
 */
export async function summarizeBotConversation(conversationId: string, opts: { claim?: boolean } = { claim: true }): Promise<boolean> {
  return !!(await summarizeBotConversationDetailed(conversationId, opts));
}

/**
 * Same as summarizeBotConversation, returning the summary + the lead. `extraFact(sum)` adds one more
 * "• " line under the summary (the partial closing's "לא השלים: …", 27/10). Never throws.
 */
export async function summarizeBotConversationDetailed(
  conversationId: string,
  opts: { claim?: boolean; extraFact?: (sum: BotSummary, leadName: string | null) => string | null } = { claim: true }
): Promise<{ summary: BotSummary; leadId: string } | null> {
  // Item 39 (summary fix): a failed summary gives its claim back, so the idle cron tries again (it used to stay unsummarized forever).
  let claimKey: string | null = null;
  let phone: string | undefined;
  const fail = async (error: unknown = "הסיכום לא נוצר"): Promise<null> => {
    if (claimKey) await releaseClaim(claimKey);
    await alertAllDogFailure({ kind: "bot_summary", error, detail: "השיחה תסוכם שוב בהרצה הבאה", phone });
    return null;
  };
  try {
    const conv = (await prisma.waBotConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, businessId: true, phone: true, profileName: true, leadId: true, summaryCallLogId: true, attributionSource: true, attributionPage: true },
    })) as ConvRow | null;
    if (!conv) return null;
    phone = conv.phone;
    // The current conversation only (a customer back after a long silence = a new line, item 30c).
    const rows = currentSession(
      (
        await prisma.waBotMessage.findMany({
          where: { conversationId, role: { not: "system" } }, // system = automation markers (item 32)
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 80,
          select: { id: true, role: true, kind: true, text: true, createdAt: true },
        })
      ).reverse()
    );
    const userTexts = rows.filter((r) => r.role === "user" && (customerWords(r) || r.kind === "image"));
    if (!userTexts.length) return null;
    const last = rows[rows.length - 1];
    if (opts.claim !== false) {
      const key = `alldog-bot-summary:${conv.id}:${last.id}`;
      if (!(await claimOnce(key, 14 * 24 * 60 * 60))) return null;
      claimKey = key;
    }

    const transcript = rows
      .map((r) => `${r.role === "user" ? (r.kind === "voice" ? "לקוח (הודעה קולית)" : "לקוח") : r.role === "human" ? "נציגה" : "בוט"}: ${r.text.replace(/\s+/g, " ").slice(0, 500)}`)
      .join("\n")
      .slice(-12000);
    const sum = await summarizeConversation("whatsapp", transcript);
    if (!sum) return fail("Claude לא החזיר סיכום תקין");
    // Item 44 (Or: "בקרה על מה הלקוח אמר"): the classification on top + the customer's own words.
    const said = rows.filter((r) => r.role === "user").map((r) => customerWords(r)).filter((t): t is string => !!t);
    const text = [withControlLines(formatBotSummary(sum, dateLabel(last.createdAt)), said), ...imageSummaryLines(rows)].join("\n");

    // The lead (the same one the bot writes to — created if missing, e.g. after a manual delete).
    const ref: BotConversationRef = { ...conv };
    await createDbExecutor(ref).saveLead({});
    const leadId = ref.leadId;
    if (!leadId) return fail("לא נמצא ליד לשיחה");
    // The conversation's one journal line: the summary replaces the body, the facts underneath stay (item 30b).
    // Item 35a: a caller who seems to be a child → a prominent line for the rep.
    const minor = sum.caller_seems_minor || seemsMinor(userTexts.map((r) => customerWords(r) ?? r.text));
    let extra: string | null = null;
    if (opts.extraFact) {
      const lead = await prisma.lead.findFirst({ where: { id: leadId, businessId: conv.businessId }, select: { name: true } });
      extra = opts.extraFact(sum, lead?.name ?? null);
    }
    await updateConversationLog(ref, leadId, (current) => {
      let next = withBody(current, text);
      if (minor) next = withFact(next, MINOR_FACT);
      if (extra) next = withFact(next, extra);
      return next;
    });
    console.log(`${LOG} conversation summarized (${maskPhone(conv.phone)})`);
    return { summary: sum, leadId };
  } catch (err) {
    console.error(`${LOG} failed:`, err instanceof Error ? err.message : err);
    return fail(err);
  }
}

/** Cron: conversations quiet for 30+ minutes (and active in the last day) get their summary. */
export async function summarizeIdleConversations(opts: { budgetMs: number; limit: number }): Promise<{ summarized: number; checked: number }> {
  const started = Date.now();
  const now = new Date();
  const convs = await prisma.waBotConversation.findMany({
    where: {
      status: { in: ["active", "handoff"] },
      lastInboundAt: { lte: new Date(now.getTime() - IDLE_SUMMARY_MS), gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { lastInboundAt: "desc" },
    take: opts.limit,
    select: { id: true },
  });
  let summarized = 0;
  for (const c of convs) {
    if (Date.now() - started > opts.budgetMs) break;
    if (await summarizeBotConversation(c.id)) summarized++;
  }
  return { summarized, checked: convs.length };
}
