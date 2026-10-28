/**
 * AllDog WhatsApp bot — the reminder + partial closing runner (Or, 27/10). Rules: nudge-rules.ts.
 *
 *   /api/cron/alldog-form-wa (pg_cron every minute) + /api/cron/alldog-call-retry (every 5 min, fallback)
 *     → processDueNudges(): conversations where the bot spoke last in the last day
 *     → decideNudge() → ONE reminder, or after 2 h the human closing → status closed_partial,
 *       summary in the lead journal with "לא השלים: …" + a HIGH task for the rep.
 *   The customer writes after closed_partial → ingest flips it back to active, onPartialResume()
 *   tells the rep, and the bot collects only what is missing (partialResumeNote).
 * Kill switch: ALLDOG_BOT_NUDGE_ENABLED=false. Never throws; every send is claimed first.
 */
import prisma from "@/lib/prisma";
import { claimOnce } from "@/lib/rate-limit";
import { maskPhone } from "@/lib/whatsapp-failure";
import { readEnv } from "@/lib/read-env";
import { allDogBusinessId, isWaBotEnabled } from "@/lib/alldog/config";
import { createLeadTask, findLeadByPhone, isPlaceholderLeadName } from "@/lib/alldog/leads";
import { addressStyleFor } from "@/lib/alldog-bot/address";
import { botMayReply, currentSession, customerWords } from "@/lib/alldog-bot/logic";
import { closingWhenNow, createDbExecutor, nameWasTyped, updateConversationLog, type BotConversationRef } from "@/lib/alldog-bot/actions";
import { withFact, withoutFact } from "@/lib/alldog-bot/journal";
import {
  CLOSED_PARTIAL_STATUS,
  decideNudge,
  firstNameForNudge,
  missingDetails,
  NOT_COMPLETED_PREFIX,
  notCompletedFact,
  NUDGE_KIND,
  PARTIAL_CLOSE_KIND,
  PARTIAL_CLOSED_MARKER_KIND,
  partialCallbackPhrase,
  partialClosingText,
  pickNudge,
  type NudgeMessage,
} from "@/lib/alldog-bot/nudge-rules";

const LOG = "[alldog-bot:nudge]";
/** Conversations whose bot reply is older than this are not looked at (the 24h window is gone anyway). */
const LOOKBACK_MS = 26 * 60 * 60 * 1000;

export function isBotNudgeEnabled(): boolean {
  return readEnv("ALLDOG_BOT_NUDGE_ENABLED")?.toLowerCase() !== "false";
}

function appUrl(): string {
  return (process.env.APP_URL || "https://petra-app.com").replace(/\/$/, "");
}

type Conv = NonNullable<Awaited<ReturnType<typeof loadConversation>>>;

async function loadConversation(id: string) {
  return prisma.waBotConversation.findUnique({ where: { id } });
}

function refOf(conv: Conv): BotConversationRef {
  return {
    id: conv.id,
    businessId: conv.businessId,
    phone: conv.phone,
    profileName: conv.profileName,
    leadId: conv.leadId,
    summaryCallLogId: conv.summaryCallLogId,
    attributionSource: conv.attributionSource,
    attributionPage: conv.attributionPage,
  };
}

async function sessionMessages(conversationId: string): Promise<NudgeMessage[]> {
  return currentSession(
    (
      await prisma.waBotMessage.findMany({
        where: { conversationId, role: { not: "system" } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 40,
        select: { id: true, role: true, kind: true, text: true, createdAt: true },
      })
    ).reverse()
  );
}

/** The customer's typed first name (never a name only heard in a voice note or the WhatsApp profile). */
async function typedFirstName(conv: Conv, messages: NudgeMessage[]): Promise<string | null> {
  const lead = await findLeadByPhone(conv.businessId, conv.phone).catch(() => null);
  if (!lead || isPlaceholderLeadName(lead.name)) return null;
  const typed = messages.filter((m) => m.role === "user" && m.kind === "text").map((m) => m.text);
  return nameWasTyped(lead.name, typed) ? firstNameForNudge(lead.name) : null;
}

/** The newest non-system message is still `id` (the customer did not write in the meantime). */
async function stillLast(conversationId: string, id: string): Promise<boolean> {
  const row = await prisma.waBotMessage.findFirst({
    where: { conversationId, role: { not: "system" } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  return row?.id === id;
}

async function sendBotText(conv: Conv, text: string, kind: string): Promise<boolean> {
  const { sendText } = await import("@/lib/alldog-bot/wa");
  const wamid = await sendText(conv.phone, text); // a failure alerts inside (item 31)
  if (!wamid) return false;
  await prisma.waBotMessage.create({ data: { conversationId: conv.id, role: "assistant", kind, text, waMessageId: wamid } });
  await prisma.waBotConversation.update({ where: { id: conv.id }, data: { lastBotReplyAt: new Date() } });
  return true;
}

async function sendNudge(conv: Conv, messages: NudgeMessage[], anchorId: string): Promise<"sent" | "skipped"> {
  if (!botMayReply(conv)) return "skipped";
  const used = (
    await prisma.waBotMessage.findMany({ where: { conversationId: conv.id, role: "assistant", kind: NUDGE_KIND }, select: { text: true } })
  ).map((r) => r.text);
  const text = pickNudge(await typedFirstName(conv, messages), used, anchorId);
  if (!text) return "skipped"; // every reminder text was used in this conversation → only the closing follows
  if (!(await claimOnce(`alldog-bot-nudge:${anchorId}`, 7 * 24 * 60 * 60))) return "skipped";
  if (!(await stillLast(conv.id, anchorId))) return "skipped";
  const ok = await sendBotText(conv, text, NUDGE_KIND);
  if (ok) console.log(`${LOG} reminder sent (${maskPhone(conv.phone)})`);
  return ok ? "sent" : "skipped";
}

/** 2 h after the reminder without an answer: the human closing + closed_partial + summary + task. */
async function closePartial(conv: Conv, messages: NudgeMessage[], anchorId: string): Promise<"closed" | "skipped"> {
  if (!(await stillLast(conv.id, anchorId))) return "skipped";
  // The status change is the claim: only one run closes a conversation.
  const claimed = await prisma.waBotConversation.updateMany({
    where: { id: conv.id, status: "active" },
    data: { status: CLOSED_PARTIAL_STATUS },
  });
  if (claimed.count === 0) return "skipped";

  const userWords = messages.filter((m) => m.role === "user").map(customerWords).filter((t): t is string => !!t);
  const firstName = await typedFirstName(conv, messages);
  const style = addressStyleFor({ texts: userWords, name: firstName ?? conv.profileName });
  const when = await closingWhenNow(conv.businessId);
  // closingWhenNow = "after_holiday" or the callbackSlot phrase ("בהקדם" while open, "מחר בבוקר"…).
  const phrase = when === "after_holiday" ? partialCallbackPhrase(new Date(), true) : when === "after_shabbat" ? "אחרי השבת" : when === "soon" ? "בהקדם" : when;
  const text = partialClosingText({ firstName, gender: style.gender, phrase, seed: conv.id });
  // Outside the 24h window WhatsApp allows no free text: the rep still gets everything below.
  const sent = botMayReply({ status: "active", lastInboundAt: conv.lastInboundAt }) ? await sendBotText(conv, text, PARTIAL_CLOSE_KIND) : false;

  // Summary of what was collected + "לא השלים: …" (one journal line per conversation).
  const found: { missing: string[] | null } = { missing: null };
  const { summarizeBotConversationDetailed } = await import("@/lib/alldog-bot/summary");
  const res = await summarizeBotConversationDetailed(conv.id, {
    claim: false,
    extraFact: (sum, leadName) => {
      found.missing = missingDetails(sum, !!leadName && !isPlaceholderLeadName(leadName));
      return notCompletedFact(found.missing);
    },
  });
  const ref = refOf((await loadConversation(conv.id)) ?? conv);
  if (!res) {
    await createDbExecutor(ref).saveLead({}).catch(() => {});
    if (ref.leadId) await updateConversationLog(ref, ref.leadId, (current) => withFact(current, notCompletedFact(null))).catch(() => {});
  }
  const leadId = res?.leadId ?? ref.leadId;
  const missing = found.missing;
  const missingList: string[] = missing ?? [];
  await prisma.waBotMessage
    .create({
      data: {
        conversationId: conv.id,
        role: "system",
        kind: PARTIAL_CLOSED_MARKER_KIND,
        text: JSON.stringify({ missing: missingList, sent }),
        waMessageId: `partial-closed:${anchorId}`,
      },
    })
    .catch(() => {});

  if (leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, businessId: conv.businessId }, select: { name: true } });
    const name = lead && !isPlaceholderLeadName(lead.name) ? lead.name : conv.profileName || maskPhone(conv.phone);
    await createLeadTask(conv.businessId, leadId, {
      title: `לחזור ל${name} – השיחה בוואטסאפ נעצרה באמצע`,
      description: [
        "הלקוח הפסיק לענות לבוט באמצע איסוף הפרטים (תזכורת אחת + שעתיים בלי תשובה).",
        missing === null ? "לא השלים: לא ידוע (הסיכום האוטומטי לא נוצר)" : missingList.length ? `לא השלים: ${missingList.join(", ")}` : "הפרטים הבסיסיים נאספו.",
        sent ? "הלקוח קיבל הודעה שנציגה תחזור אליו." : "לא נשלחה הודעת סיום (עברו 24 שעות מההודעה שלו) – להתקשר.",
        "השיחה בוואטסאפ: כרטיס הליד → וואטסאפ עם הבוט.",
      ].join("\n"),
      priority: "HIGH",
    }).catch((err) => console.error(`${LOG} task failed:`, err instanceof Error ? err.message : err));
  }
  console.log(`${LOG} closed_partial (${maskPhone(conv.phone)}), message ${sent ? "sent" : "not sent"}`);
  return "closed";
}

/** Cron: reminders + partial closings that are due. */
export async function processDueNudges(opts: { budgetMs: number; limit: number } = { budgetMs: 40_000, limit: 30 }) {
  const out = { checked: 0, nudged: 0, closed: 0 };
  const businessId = allDogBusinessId();
  if (!businessId || !isWaBotEnabled() || !isBotNudgeEnabled()) return { ...out, skipped: "disabled" as const };
  const started = Date.now();
  const now = new Date();
  const convs = await prisma.waBotConversation.findMany({
    where: { businessId, status: "active", lastBotReplyAt: { gte: new Date(now.getTime() - LOOKBACK_MS) } },
    orderBy: { lastBotReplyAt: "desc" },
    take: 200,
  });
  // The bot spoke last (Prisma cannot compare two columns).
  const candidates = convs.filter((c) => c.lastBotReplyAt && (!c.lastInboundAt || c.lastBotReplyAt > c.lastInboundAt)).slice(0, opts.limit);
  for (const conv of candidates) {
    if (Date.now() - started > opts.budgetMs) break;
    out.checked++;
    try {
      const messages = await sessionMessages(conv.id);
      const d = decideNudge({ status: conv.status, lastHumanAt: conv.lastHumanAt, messages, now: new Date() });
      if (d.action === "nudge" && (await sendNudge(conv, messages, d.anchorId)) === "sent") out.nudged++;
      if (d.action === "close" && (await closePartial(conv, messages, d.anchorId)) === "closed") out.closed++;
    } catch (err) {
      console.error(`${LOG} conversation failed (${maskPhone(conv.phone)}):`, err instanceof Error ? err.message : err);
    }
  }
  return out;
}

/** What was missing at the partial closing (for the bot's note after the customer is back). */
export async function partialClosedMissing(conversationId: string, since: Date): Promise<string[] | null> {
  const row = await prisma.waBotMessage.findFirst({
    where: { conversationId, role: "system", kind: PARTIAL_CLOSED_MARKER_KIND, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { text: true },
  });
  if (!row) return null;
  try {
    const m = (JSON.parse(row.text) as { missing?: unknown }).missing;
    return Array.isArray(m) ? m.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * The customer wrote after the partial closing (ingest already set the status back to active):
 * the rep hears about it (journal fact + owner WhatsApp/email with the text). Never throws.
 */
export async function onPartialResume(conversationId: string): Promise<void> {
  try {
    const conv = await loadConversation(conversationId);
    if (!conv) return;
    if (!(await claimOnce(`alldog-bot-partial-resume:${conv.id}:${conv.lastInboundAt?.getTime() ?? 0}`, 24 * 60 * 60))) return;
    const ref = refOf(conv);
    await createDbExecutor(ref).saveLead({});
    const latest = await prisma.waBotMessage.findFirst({
      where: { conversationId, role: "user" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { text: true, kind: true },
    });
    const quote = latest ? (customerWords(latest) ?? latest.text).replace(/\s+/g, " ").slice(0, 300) : "";
    if (ref.leadId) {
      await updateConversationLog(ref, ref.leadId, (current) =>
        withFact(withoutFact(current, NOT_COMPLETED_PREFIX), `הלקוח חזר לשיחה אחרי שנסגרה באמצע${quote ? ` · "${quote}"` : ""}`)
      );
    }
    const lead = ref.leadId ? await prisma.lead.findFirst({ where: { id: ref.leadId, businessId: ref.businessId }, select: { name: true } }) : null;
    const name = lead && !isPlaceholderLeadName(lead.name) ? lead.name : conv.profileName || maskPhone(conv.phone);
    const { notifyOwnerAllDog } = await import("@/lib/notify-owner");
    await notifyOwnerAllDog({
      title: "לקוח חזר לשיחה בוואטסאפ אחרי שנסגרה באמצע (הבוט משלים את הפרטים)",
      lines: [`${name} · ${maskPhone(conv.phone)}`, ...(quote ? [`"${quote}"`] : [])],
      url: ref.leadId ? `${appUrl()}/leads?lead=${ref.leadId}` : undefined,
    });
  } catch (err) {
    console.error(`${LOG} resume alert failed:`, err instanceof Error ? err.message : err);
  }
}
