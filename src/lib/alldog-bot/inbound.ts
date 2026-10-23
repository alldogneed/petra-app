/**
 * AllDog WhatsApp bot — inbound flow.
 *
 *   webhook → ingestWebhookPayload() (store, 200 right away)
 *          → processInbound() after the response:
 *              read + "typing…" → 6s quiet period (only the latest message's run goes on)
 *              → Claude with tools → ≤2 messages with a typing pause → stored.
 *
 * Silence: handoff / stopped conversations, outside the 24h window, groups, statuses,
 * system messages. Media → a fixed gentle reply + a task for a person.
 */
import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { maskPhone } from "@/lib/whatsapp-failure";
import { allDogBusinessId, botModel, isWaBotEnabled } from "@/lib/alldog/config";
import { heDayLabel, israelParts, nextCallbackOptions } from "@/lib/alldog/time";
import { addLeadCallLog, isPlaceholderLeadName } from "@/lib/alldog/leads";
import {
  botMayReply,
  classifyInbound,
  isStopRequest,
  MEDIA_REPLY,
  parseAttributionLine,
  splitReply,
  toChatTurns,
  typingDelayMs,
  waitForQuiet,
  type MetaInboundMessage,
} from "@/lib/alldog-bot/logic";
import { buildBotContext, enforceIdentityAnswer, HUMAN_BITE_NOTE, mentionsHumanBite } from "@/lib/alldog-bot/prompt";
import { runBotTurn } from "@/lib/alldog-bot/agent";
import { createDbExecutor, flagMediaForHuman, type BotConversationRef } from "@/lib/alldog-bot/actions";
import { markReadWithTyping, sendText } from "@/lib/alldog-bot/wa";

const LOG = "[alldog-bot]";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface MetaChangeValue {
  metadata?: { phone_number_id?: string };
  contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
  messages?: MetaInboundMessage[];
}

export interface PendingInbound {
  conversationId: string;
  waMessageId: string;
}

/** Store the inbound messages for the AllDog number. Returns the ones the bot should process. */
export async function ingestWebhookPayload(body: unknown, phoneNumberId: string): Promise<PendingInbound[]> {
  const businessId = allDogBusinessId();
  if (!businessId || !isWaBotEnabled()) return [];
  const pending: PendingInbound[] = [];
  const entries = (body as { entry?: Array<{ changes?: Array<{ field?: string; value?: MetaChangeValue }> }> })?.entry ?? [];

  for (const e of entries) {
    for (const c of e.changes ?? []) {
      const v = c.value;
      if (!v || v.metadata?.phone_number_id !== phoneNumberId) continue;
      for (const m of v.messages ?? []) {
        try {
          const item = await ingestMessage(businessId, m, v.contacts ?? []);
          if (item) pending.push(item);
        } catch (err) {
          console.error(`${LOG} ingest failed:`, err instanceof Error ? err.message : err);
        }
      }
    }
  }
  return pending;
}

async function ingestMessage(
  businessId: string,
  m: MetaInboundMessage,
  contacts: Array<{ wa_id?: string; profile?: { name?: string } }>
): Promise<PendingInbound | null> {
  const cls = classifyInbound(m);
  if (cls.kind === "ignore") return null;
  const phone = m.from!.replace(/\D/g, "");
  const ts = m.timestamp && /^\d+$/.test(m.timestamp) ? new Date(Number(m.timestamp) * 1000) : new Date();
  const at = Math.abs(ts.getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000 ? ts : new Date();
  const profileName = contacts.find((c) => c.wa_id === m.from)?.profile?.name?.trim().slice(0, 100) || null;

  let text: string;
  let attribution: { source: string | null; page: string | null } | null = null;
  if (cls.kind === "text") {
    const parsed = parseAttributionLine(cls.text);
    if (parsed.source || parsed.page) attribution = { source: parsed.source, page: parsed.page };
    text = parsed.text || cls.text;
  } else {
    text = `[${cls.label}]`;
  }

  const upsertConversation = () =>
    prisma.waBotConversation.upsert({
      where: { businessId_phone: { businessId, phone } },
      create: {
        businessId,
        phone,
        profileName,
        lastInboundAt: at,
        attributionSource: attribution?.source ?? null,
        attributionPage: attribution?.page ?? null,
      },
      update: {
        lastInboundAt: at,
        ...(profileName ? { profileName } : {}),
      },
    });
  let conv: Awaited<ReturnType<typeof upsertConversation>>;
  try {
    conv = await upsertConversation();
  } catch (err) {
    // Two first messages of a new number in parallel → one create loses the race; retry as update.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    conv = await upsertConversation();
  }
  if (attribution && !conv.attributionSource && !conv.attributionPage) {
    await prisma.waBotConversation.update({
      where: { id: conv.id },
      data: { attributionSource: attribution.source, attributionPage: attribution.page },
    });
  }

  try {
    await prisma.waBotMessage.create({
      // createdAt = arrival time (ms), not Meta's second-precision timestamp: "latest message" must be unambiguous.
      data: { conversationId: conv.id, role: "user", kind: cls.kind, text: text.slice(0, 4000), waMessageId: m.id! },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null; // Meta retry
    throw err;
  }

  if (cls.kind === "text" && isStopRequest(text) && conv.status !== "stopped") {
    await prisma.waBotConversation.update({ where: { id: conv.id }, data: { status: "stopped", stoppedAt: new Date() } });
    if (conv.leadId) await addLeadCallLog(conv.leadId, "[וואטסאפ · בוט] הלקוח ביקש להפסיק את השיחה עם הבוט").catch(() => {});
    console.log(`${LOG} ${maskPhone(phone)} asked to stop — conversation stopped`);
    return null;
  }
  if (conv.status !== "active") return null; // handoff / stopped: stored, never answered
  return { conversationId: conv.id, waMessageId: m.id! };
}

async function latestInboundId(conversationId: string): Promise<string | null> {
  const row = await prisma.waBotMessage.findFirst({
    where: { conversationId, role: "user" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { waMessageId: true },
  });
  return row?.waMessageId ?? null;
}

/** Run after the webhook response. Never throws. */
export async function processInbound(item: PendingInbound): Promise<void> {
  try {
    await markReadWithTyping(item.waMessageId);
    const isLatest = await waitForQuiet({
      myMessageId: item.waMessageId,
      latestInboundId: () => latestInboundId(item.conversationId),
      sleep,
    });
    if (!isLatest) return; // a newer message's run answers both
    await reply(item);
  } catch (err) {
    console.error(`${LOG} processing failed:`, err instanceof Error ? err.message : err);
  }
}

async function reply(item: PendingInbound): Promise<void> {
  const conv = await prisma.waBotConversation.findUnique({ where: { id: item.conversationId } });
  if (!conv || !botMayReply(conv)) return;
  const ref: BotConversationRef = {
    id: conv.id,
    businessId: conv.businessId,
    phone: conv.phone,
    profileName: conv.profileName,
    leadId: conv.leadId,
    summaryCallLogId: conv.summaryCallLogId,
    attributionSource: conv.attributionSource,
    attributionPage: conv.attributionPage,
  };

  const rows = (
    await prisma.waBotMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 40,
      select: { role: true, kind: true, text: true },
    })
  ).reverse();
  const lastAssistant = rows.map((r) => r.role).lastIndexOf("assistant");
  const batch = rows.slice(lastAssistant + 1).filter((r) => r.role === "user");
  if (!batch.length) return;

  // Only media since our last reply → fixed answer (once in a row) + a task for a person.
  const mediaOnly = batch.every((r) => r.kind === "media");
  if (mediaOnly) {
    await flagMediaForHuman(ref, batch[batch.length - 1].text.replace(/[[\]]/g, ""));
    if (lastAssistant >= 0 && rows[lastAssistant].text === MEDIA_REPLY) return;
    await sendParts(item, conv.phone, [MEDIA_REPLY]);
    return;
  }
  const hadMedia = batch.some((r) => r.kind === "media");
  if (hadMedia) await flagMediaForHuman(ref, batch.find((r) => r.kind === "media")!.text.replace(/[[\]]/g, ""));

  const history = toChatTurns(
    rows.map((r) => ({
      role: r.role,
      text: r.kind === "media" ? `${r.text} (הלקוח שלח מדיה — אין לך אפשרות לראות או לשמוע אותה)` : r.text,
    }))
  );
  if (!history.length || history[history.length - 1].role !== "user") return;

  let knownName: string | null = null;
  if (conv.leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: conv.leadId, businessId: conv.businessId }, select: { name: true } });
    if (lead && !isPlaceholderLeadName(lead.name)) knownName = lead.name;
  }
  const now = new Date();
  const p = israelParts(now);
  const context = buildBotContext({
    nowLabel: `${heDayLabel(p.ymd)} בשעה ${p.hhmm}`,
    callbackOptions: nextCallbackOptions(now, 3).map((o) => `${o.label} (date=${o.ymd}, time=${o.hhmm})`),
    attribution: conv.attributionSource || conv.attributionPage ? { source: conv.attributionSource, page: conv.attributionPage } : null,
    knownName,
    isFirstReply: lastAssistant < 0,
    note: [
      batch.some((r) => r.kind === "text" && mentionsHumanBite(r.text)) ? HUMAN_BITE_NOTE : null,
      hadMedia ? "הלקוח שלח גם מדיה שאתה לא יכול לפתוח. אמור בעדינות שנציגה תראה אותה." : null,
    ].filter(Boolean).join("\n") || null,
  });

  const result = await runBotTurn({
    client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
    model: botModel(),
    context,
    history,
    executor: createDbExecutor(ref),
  });

  const latestUserText = batch.filter((r) => r.kind === "text").map((r) => r.text).pop() ?? "";
  let text = enforceIdentityAnswer(latestUserText, result.reply);
  let afterHandoff = result.handedOff;
  if (!text) {
    if (!result.handedOff) {
      // Refusal / empty answer: a person takes over rather than the customer being ignored.
      await createDbExecutor(ref).handoff({ reason: `הבוט לא הצליח לענות (${result.stopReason ?? "ללא תשובה"})`, urgency: "normal" });
      text = "נציגה מהמשרד תחזור אליך בהקדם 🙂";
      afterHandoff = true;
    } else {
      return;
    }
  }

  // A newer message arrived while the model was thinking → its own run will answer.
  if ((await latestInboundId(conv.id)) !== item.waMessageId) return;
  await sendParts(item, conv.phone, splitReply(text, 2), afterHandoff);
}

async function sendParts(item: PendingInbound, to: string, parts: string[], allowAfterHandoff = false): Promise<void> {
  for (const part of parts) {
    const conv = await prisma.waBotConversation.findUnique({
      where: { id: item.conversationId },
      select: { status: true, lastInboundAt: true },
    });
    if (!conv) return;
    // Re-checked before every message: stop/handoff in the meantime, and never outside 24h.
    const statusOk = conv.status === "active" || (allowAfterHandoff && conv.status === "handoff");
    if (!statusOk || !botMayReply({ status: "active", lastInboundAt: conv.lastInboundAt })) return;

    await markReadWithTyping(item.waMessageId);
    await sleep(typingDelayMs(part));
    if ((await latestInboundId(item.conversationId)) !== item.waMessageId) return;

    const wamid = await sendText(to, part);
    if (!wamid) return;
    await prisma.waBotMessage.create({
      data: { conversationId: item.conversationId, role: "assistant", text: part, waMessageId: wamid },
    });
    await prisma.waBotConversation.update({ where: { id: item.conversationId }, data: { lastBotReplyAt: new Date() } });
  }
}
