/**
 * AllDog WhatsApp bot — inbound flow.
 *
 *   webhook → ingestWebhookPayload() (store, 200 right away)
 *          → processInbound() after the response:
 *              read + "typing…" → 6s quiet period (only the latest message's run goes on)
 *              → Claude with tools → ≤2 messages with a typing pause → stored.
 *
 * Silence: stopped conversations, outside the 24h window, groups, statuses,
 * system messages. Media → a fixed gentle reply + a task for a person.
 * Handoff (handoff.ts): every customer message → alert to the rep; the bot answers once
 * ("קיבלנו 🙂 …", then ≤ 1 per 6h); 24h without a person → back to the bot.
 * "#reset" from Or's number only → his conversation starts over.
 */
import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { maskPhone } from "@/lib/whatsapp-failure";
import { allDogBusinessId, botModel, isWaBotEnabled } from "@/lib/alldog/config";
import { heDayLabel, israelParts, nextCallbackOptions } from "@/lib/alldog/time";
import { addLeadCallLog, createLeadTask, isPlaceholderLeadName } from "@/lib/alldog/leads";
import {
  botMayReply,
  classifyInbound,
  isWithin24hWindow,
  isStopRequest,
  MEDIA_REPLY,
  parseAttributionLine,
  splitReply,
  toChatTurns,
  typingDelayMs,
  waitForQuiet,
  type MetaInboundMessage,
} from "@/lib/alldog-bot/logic";
import { buildBotContext, enforceIdentityAnswer, enforceOpening, HUMAN_BITE_NOTE, mentionsHumanBite } from "@/lib/alldog-bot/prompt";
import { HANDOFF_MODE_TOOLS, runBotTurn } from "@/lib/alldog-bot/agent";
import { createDbExecutor, flagMediaForHuman, type BotConversationRef } from "@/lib/alldog-bot/actions";
import {
  HANDOFF_MODE_NOTE,
  HUMAN_ON_THE_WAY,
  handoffAckDue,
  handoffClosingText,
  handoffNoteText,
  isHumanRequest,
  isResetCommand,
  repIsActive,
  RESUMED_NOTE,
  shouldAutoResume,
  withClosing,
} from "@/lib/alldog-bot/handoff";
import { claimOnce } from "@/lib/rate-limit";
import { markReadWithTyping, sendText } from "@/lib/alldog-bot/wa";
import { readEnv } from "@/lib/read-env";

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
  /** "reset" = Or's #reset (confirmation only); default = normal bot / handoff flow. */
  mode?: "reset";
}

const RESET_CONFIRMATION = "🔄 השיחה אופסה. אפשר להתחיל מחדש";

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

  if (cls.kind === "text" && isResetCommand(text, phone)) {
    await resetConversation(conv.id);
    console.log(`${LOG} ${maskPhone(phone)} #reset — conversation wiped`);
    return { conversationId: conv.id, waMessageId: m.id!, mode: "reset" };
  }

  if (cls.kind === "text" && isStopRequest(text) && conv.status !== "stopped") {
    await prisma.waBotConversation.update({ where: { id: conv.id }, data: { status: "stopped", stoppedAt: new Date() } });
    if (conv.leadId) await addLeadCallLog(conv.leadId, "[וואטסאפ · בוט] הלקוח ביקש להפסיק את השיחה עם הבוט").catch(() => {});
    console.log(`${LOG} ${maskPhone(phone)} asked to stop — conversation stopped`);
    return null;
  }
  if (conv.status === "stopped") return null; // stored, never answered
  if (conv.status === "handoff" && shouldAutoResume(conv)) {
    // 24h without a person → the bot takes the conversation back.
    await prisma.waBotConversation.updateMany({
      where: { id: conv.id, status: "handoff" },
      data: { status: "active", resumedAt: new Date() },
    });
    if (conv.leadId) {
      await addLeadCallLog(conv.leadId, "[וואטסאפ · בוט] 24 שעות בלי מענה מנציגה, השיחה חזרה לבוט").catch(() => {});
    }
    console.log(`${LOG} ${maskPhone(phone)} handoff expired — back to the bot`);
  }
  // active → the bot answers; handoff → alert to the rep + one "קיבלנו" (processInbound decides).
  return { conversationId: conv.id, waMessageId: m.id! };
}

/** Or's "#reset": the conversation starts over (messages deleted, lead link + handoff state cleared; the lead itself stays). */
async function resetConversation(conversationId: string): Promise<void> {
  await prisma.waBotMessage.deleteMany({ where: { conversationId } });
  await prisma.waBotConversation.update({
    where: { id: conversationId },
    data: {
      status: "active",
      leadId: null,
      summaryCallLogId: null,
      attributionSource: null,
      attributionPage: null,
      lastBotReplyAt: null,
      handoffAt: null,
      handoffNotifiedAt: null,
      handoffAckAt: null,
      lastHumanAt: null,
      resumedAt: null,
      stoppedAt: null,
    },
  });
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
    if (item.mode === "reset") {
      const conv = await prisma.waBotConversation.findUnique({ where: { id: item.conversationId }, select: { phone: true } });
      if (conv) await sendText(conv.phone, RESET_CONFIRMATION);
      return;
    }
    const state = await prisma.waBotConversation.findUnique({ where: { id: item.conversationId }, select: { status: true } });
    if (state?.status === "handoff") {
      // Alerts first; "typing…" only if the bot answers (sendParts shows it).
      const isLatest = await waitForQuiet({
        myMessageId: item.waMessageId,
        latestInboundId: () => latestInboundId(item.conversationId),
        sleep,
      });
      if (isLatest) await handleHandoffMessages(item);
      return;
    }
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

/**
 * One bot turn. mode "handoff" (Or, 24/10): the conversation is with a person — the bot still
 * answers general questions with lookup_guide + save_lead only, no opening, no new handoff.
 */
async function reply(item: PendingInbound, mode: "normal" | "handoff" = "normal"): Promise<void> {
  const conv = await prisma.waBotConversation.findUnique({ where: { id: item.conversationId } });
  if (!conv) return;
  const handoffMode = mode === "handoff";
  if (handoffMode ? conv.status !== "handoff" || !isWithin24hWindow(conv.lastInboundAt) : !botMayReply(conv)) return;
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
  const lastReply = Math.max(lastAssistant, rows.map((r) => r.role).lastIndexOf("human"));
  const batch = rows.slice(lastReply + 1).filter((r) => r.role === "user");
  if (!batch.length) return;

  // Safety case: a person was bitten → the team hears about it NOW, while the bot collects the basics.
  if (!handoffMode && batch.some((r) => r.kind === "text" && mentionsHumanBite(r.text))) {
    await alertBiteReported(ref, batch.filter((r) => r.kind === "text").map((r) => r.text));
  }

  // Only media since our last reply → fixed answer (once in a row) + a task for a person.
  const mediaOnly = batch.every((r) => r.kind === "media");
  if (mediaOnly && handoffMode) return; // the rep already got the alert
  if (mediaOnly) {
    await flagMediaForHuman(ref, batch[batch.length - 1].text.replace(/[[\]]/g, ""));
    if (lastAssistant >= 0 && rows[lastAssistant].text === MEDIA_REPLY) return;
    await sendParts(item, conv.phone, [MEDIA_REPLY]);
    return;
  }
  const hadMedia = batch.some((r) => r.kind === "media");
  if (hadMedia && !handoffMode) await flagMediaForHuman(ref, batch.find((r) => r.kind === "media")!.text.replace(/[[\]]/g, ""));

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
      handoffMode ? HANDOFF_MODE_NOTE : null,
      conv.resumedAt && (!conv.lastBotReplyAt || conv.lastBotReplyAt < conv.resumedAt) ? RESUMED_NOTE : null,
      // Any bite reported in this conversation (not only in this batch) until the handoff happens.
      !handoffMode && rows.some((r) => r.role === "user" && r.kind === "text" && mentionsHumanBite(r.text)) ? HUMAN_BITE_NOTE : null,
      hadMedia ? "הלקוח שלח גם מדיה שאתה לא יכול לפתוח. אמור בעדינות שנציגה תראה אותה." : null,
    ].filter(Boolean).join("\n") || null,
  });

  const executor = createDbExecutor(ref);
  const result = await runBotTurn({
    client: new Anthropic({ apiKey: readEnv("ANTHROPIC_API_KEY") }),
    model: botModel(),
    context,
    history,
    executor,
    ...(handoffMode ? { tools: HANDOFF_MODE_TOOLS } : {}),
  });

  const latestUserText = batch.filter((r) => r.kind === "text").map((r) => r.text).pop() ?? "";
  let text = enforceIdentityAnswer(latestUserText, result.reply);
  if (executor.closing) {
    // After schedule_callback / handoff_to_human the last message is always the fixed closing.
    text = withClosing(text, executor.closing);
  } else if (!handoffMode) {
    const firstUserText = batch.filter((r) => r.kind === "text").map((r) => r.text).join("\n");
    text = enforceOpening(lastAssistant < 0, firstUserText, text);
  }
  let afterHandoff = result.handedOff || handoffMode;
  if (!text) {
    if (handoffMode) return;
    if (!result.handedOff) {
      // Refusal / empty answer: a person takes over rather than the customer being ignored.
      await createDbExecutor(ref).handoff({ reason: `הבוט לא הצליח לענות (${result.stopReason ?? "ללא תשובה"})`, urgency: "normal" });
      text = handoffClosingText();
      afterHandoff = true;
    } else {
      return;
    }
  }

  // A newer message arrived while the model was thinking → its own run will answer.
  if ((await latestInboundId(conv.id)) !== item.waMessageId) return;
  await sendParts(item, conv.phone, splitReply(text, 2), afterHandoff);
}

const HANDOFF_TASK_PREFIX = "הודעה חדשה בוואטסאפ";

function appUrl(): string {
  return (process.env.APP_URL || "https://petra-app.com").replace(/\/$/, "");
}

/**
 * Customer wrote while the conversation is with a rep: everything since the last alert goes
 * to the rep (lead note + one open task + owner WhatsApp/email with the text). Then the bot keeps
 * helping (reply(…, "handoff")), except: rep active in Petra → quiet; explicit "I want a person" →
 * HUMAN_ON_THE_WAY, at most once per 6 hours.
 */
async function handleHandoffMessages(item: PendingInbound): Promise<void> {
  const conv = await prisma.waBotConversation.findUnique({ where: { id: item.conversationId } });
  if (!conv || conv.status !== "handoff") return;
  const since = conv.handoffNotifiedAt ?? conv.handoffAt ?? new Date(0);
  const fresh = await prisma.waBotMessage.findMany({
    where: { conversationId: conv.id, role: "user", createdAt: { gt: since } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { text: true, createdAt: true },
    take: 30,
  });
  if (!fresh.length) return;

  // Claim this batch (two runs never alert the same messages twice).
  const now = new Date();
  const claimed = await prisma.waBotConversation.updateMany({
    where: { id: conv.id, status: "handoff", handoffNotifiedAt: conv.handoffNotifiedAt },
    data: { handoffNotifiedAt: now },
  });
  if (claimed.count === 0) return;

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
  const texts = fresh.map((r) => r.text.slice(0, 1000));
  try {
    await createDbExecutor(ref).saveLead({}); // makes sure there is a lead (ref.leadId)
    const leadId = ref.leadId;
    if (leadId) {
      await addLeadCallLog(leadId, handoffNoteText(texts));
      const lead = await prisma.lead.findFirst({ where: { id: leadId, businessId: conv.businessId }, select: { name: true } });
      const name = lead && !isPlaceholderLeadName(lead.name) ? lead.name : conv.profileName || conv.phone;
      const open = await prisma.task.findFirst({
        where: {
          businessId: conv.businessId,
          relatedEntityType: "LEAD",
          relatedEntityId: leadId,
          status: { in: ["OPEN", "IN_PROGRESS"] },
          title: { startsWith: HANDOFF_TASK_PREFIX },
        },
        select: { id: true },
      });
      if (!open) {
        await createLeadTask(conv.businessId, leadId, {
          title: `${HANDOFF_TASK_PREFIX} מ${name} (אחרי העברה לנציגה)`,
          description: [`הלקוח כתב אחרי שהשיחה הועברה לנציגה:`, ...texts.map((t) => `• ${t}`), "", "אפשר לענות מכרטיס הליד → וואטסאפ."]
            .join("\n")
            .slice(0, 4900),
          priority: "HIGH",
        });
      }
      const { notifyOwnerAllDog } = await import("@/lib/notify-owner");
      await notifyOwnerAllDog({
        title: "וואטסאפ: הלקוח כתב אחרי העברה לנציגה",
        lines: [`${name} · ${maskPhone(conv.phone)}`, ...texts.map((t) => `"${t.replace(/\s+/g, " ").slice(0, 300)}"`)],
        url: `${appUrl()}/leads?lead=${leadId}`,
      });
    }
  } catch (err) {
    console.error(`${LOG} handoff alert failed:`, err instanceof Error ? err.message : err);
  }

  // A rep answering from Petra right now → the bot does not talk over them.
  if (repIsActive(conv.lastHumanAt, now)) return;
  // "I want a person" → one fixed line, at most once per 6 hours; nothing more.
  if (texts.some((t) => isHumanRequest(t))) {
    if (!handoffAckDue(conv, now)) return;
    const ack = await prisma.waBotConversation.updateMany({
      where: { id: conv.id, status: "handoff", handoffAckAt: conv.handoffAckAt },
      data: { handoffAckAt: now },
    });
    if (ack.count > 0) await sendParts(item, conv.phone, [HUMAN_ON_THE_WAY], true);
    return;
  }
  // Anything else: the bot keeps helping (general questions, new details → the lead).
  await reply(item, "handoff");
}

/** A person was bitten: URGENT alert to the team right away (once per conversation per day). */
async function alertBiteReported(ref: BotConversationRef, texts: string[]): Promise<void> {
  try {
    if (!(await claimOnce(`alldog-bot-bite:${ref.id}`, 24 * 60 * 60))) return;
    await createDbExecutor(ref).saveLead({});
    const lead = ref.leadId
      ? await prisma.lead.findFirst({ where: { id: ref.leadId, businessId: ref.businessId }, select: { name: true } })
      : null;
    const name = lead && !isPlaceholderLeadName(lead.name) ? lead.name : ref.profileName || ref.phone;
    const { notifyOwnerAllDog } = await import("@/lib/notify-owner");
    await notifyOwnerAllDog({
      title: "דחוף: דיווח על נשיכה בוואטסאפ (הבוט אוסף פרטים ויעביר למאלף)",
      lines: [`${name} · ${maskPhone(ref.phone)}`, ...texts.map((t) => `"${t.replace(/\s+/g, " ").slice(0, 300)}"`)],
      url: ref.leadId ? `${appUrl()}/leads?lead=${ref.leadId}` : undefined,
    });
  } catch (err) {
    console.error(`${LOG} bite alert failed:`, err instanceof Error ? err.message : err);
  }
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
