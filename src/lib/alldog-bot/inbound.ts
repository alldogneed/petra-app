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
import { allDogAnthropicKey, allDogBusinessId, botModel, isWaBotEnabled } from "@/lib/alldog/config";
import { heDayLabel, israelParts } from "@/lib/alldog/time";
import { CLOSED_PARTIAL_STATUS, partialResumeNote } from "@/lib/alldog-bot/nudge-rules";
import { onPartialResume, partialClosedMissing } from "@/lib/alldog-bot/nudge";
import { describeImage, descriptionLine, imageBlockFor, mediaLogText, mediaRefsFor, saveMediaRef } from "@/lib/alldog-bot/images";
import {
  asksForReading,
  claimOffer,
  GUIDE_LINK_MESSAGE_KIND,
  GUIDE_OFFER_MESSAGE_KIND,
  guideBySlug,
  guideLinkMessage,
  guideOfferText,
  isOnlyYes,
  isYesToOffer,
  preciseGuideFor,
  readOffer,
  rememberedGuide,
  rememberGuide,
  setOfferStatus,
  stripGuideLinks,
} from "@/lib/alldog-bot/guide-offer";
import type { KnowledgeEntry } from "@/lib/alldog-bot/knowledge";
import { addLeadCallLog, createLeadTask, findLeadByPhone, isPlaceholderLeadName } from "@/lib/alldog/leads";
import {
  applyConversationGuards,
  botMayReply,
  classifyInbound,
  cleanTranscript,
  customerWords,
  cityAlreadyGiven,
  currentSession,
  startsNewSession,
  dropCheerfulOpeners,
  isSeriousIncident,
  namePlaceNote,
  parseNamePlace,
  stripVocativeName,
  voiceNameNote,
  voiceOnlyName,
  isVoiceFailed,
  isWithin24hWindow,
  isStopRequest,
  MEDIA_REPLY,
  IMAGE_NOTE,
  MORE_PHOTOS_NOTE,
  BREED_GUESS_ANSWER,
  asksBreedGuess,
  dropBreedGuesses,
  enforceBreedAnswer,
  ownerBreedNote,
  UNREADABLE_MEDIA_NOTE,
  imageMessageText,
  imageHistoryText,
  parseImageMessageText,
  dropLimitationLines,
  dropMidConversationGreeting,
  mediaLabelOf,
  captionOf,
  parseAttributionLine,
  splitReply,
  toChatTurns,
  typingDelayMs,
  urgencyReason,
  VOICE_FAILED_REPLY,
  VOICE_FAILED_TEXT,
  VOICE_PENDING_TEXT,
  voiceHistoryText,
  voiceNoteLogText,
  waitForQuiet,
  type MetaInboundMessage,
  MINOR_NOTE,
  seemsMinor,
  asksPrice,
  pricesAlreadySent,
  PRICE_QUESTION_NOTE,
} from "@/lib/alldog-bot/logic";
import { buildBotContext, enforceIdentityAnswer, enforceOpening, HUMAN_BITE_NOTE, mentionsHumanBite } from "@/lib/alldog-bot/prompt";
import { HANDOFF_MODE_TOOLS, runBotTurn } from "@/lib/alldog-bot/agent";
import { closingWhenNow, createDbExecutor, dropDeletedLeadLink, flagMediaForHuman, updateConversationLog, type BotConversationRef } from "@/lib/alldog-bot/actions";
import { MINOR_FACT, withFact } from "@/lib/alldog-bot/journal";
import { summarizeBotConversation } from "@/lib/alldog-bot/summary";
import { fixOutOfAreaLines } from "@/lib/alldog-bot/areas";
import { addressNote, addressStyleFor, applyAddressStyle, detectGender, type Gender } from "@/lib/alldog-bot/address";
import {
  CLOSED_NOTE,
  HANDOFF_MODE_NOTE,
  humanOnTheWay,
  botFallbackText,
  closingAlreadySent,
  handoffAckDue,
  handoffClosingText,
  handoffNoteText,
  isHumanRequest,
  isResetCommand,
  repIsActive,
  RESUMED_NOTE,
  TRANSITION_MARKER,
  shouldAutoResume,
  withClosing,
} from "@/lib/alldog-bot/handoff";
import { claimOnce } from "@/lib/rate-limit";
import { downloadMedia, markReadWithTyping, sendText } from "@/lib/alldog-bot/wa";
import { alertAllDogFailure, explainFailure } from "@/lib/alldog/failure-alerts";
import { displayMissedCallMessage, isMissedCallTemplateMessage, MISSED_CALL_CONTEXT_NOTE, MISSED_CALL_DEDUP_MS, MISSED_CALL_KINDS } from "@/lib/alldog/missed-call-rules";
import { FORM_LEAD_MESSAGE_KIND, formLeadContextNote } from "@/lib/alldog/form-lead-rules";
import { transcribeAudio } from "@/lib/stt";
import {
  alreadyWithRep,
  enforcePriceAnswer,
  fixWhoCallsBack,
  GENERAL_FOLLOWUP_ACK,
  GENERAL_KIND_LABELS,
  generalClosingFor,
  generalInquiryKind,
  generalQuestion,
  generalTopicMissing,
  isQuestion,
  mentionsDogNeed,
  repCallbackMissed,
  repMissedLine,
  typedNameOf,
  WITH_REP_DETAILS_ACK,
  WITH_REP_LINE,
  WITH_REP_LOG,
  WITH_REP_MET_LINE,
  type GeneralKind,
} from "@/lib/alldog-bot/general-rules";
import {
  appendToGeneralTask,
  clearGeneralState,
  finishGeneralInquiry,
  GENERAL_STATUS,
  generalContact,
  handToRep,
  isWithRep,
  markWithRep,
  readGeneralState,
  repMissedTask,
  saveGeneralState,
  type GeneralState,
} from "@/lib/alldog-bot/general";

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
  /** A voice note to transcribe before the bot answers (item 28a). */
  voice?: { mediaId: string; mimeType: string | null };
  /** A photo to describe before the bot answers (item 39). */
  image?: { mediaId: string; mimeType: string | null; caption: string | null };
  /** The customer wrote after the partial closing (27/10) → the rep is told, then the bot answers. */
  resumedFromPartial?: boolean;
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
  } else if (cls.kind === "voice") {
    text = VOICE_PENDING_TEXT; // replaced by the transcript (or VOICE_FAILED_TEXT) in processInbound
  } else if (cls.kind === "image") {
    text = imageMessageText(null, cls.caption); // the description is added in processInbound (item 39)
  } else {
    text = cls.caption ? `[${cls.label}]\nכיתוב: ${cls.caption}` : `[${cls.label}]`;
  }
  const voice = cls.kind === "voice" ? { mediaId: cls.mediaId, mimeType: cls.mimeType } : undefined;
  const image = cls.kind === "image" ? { mediaId: cls.mediaId, mimeType: cls.mimeType, caption: cls.caption } : undefined;

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
  // The customer is back after a long silence → a new conversation gets its own journal line (item 30c).
  const before = await prisma.waBotConversation.findUnique({
    where: { businessId_phone: { businessId, phone } },
    select: { id: true, lastInboundAt: true, summaryCallLogId: true, status: true },
  });
  if (before?.summaryCallLogId && startsNewSession(before.lastInboundAt, at)) {
    await prisma.waBotConversation.update({ where: { id: before.id }, data: { summaryCallLogId: null } });
  }
  // Item 40.1: a general (non-dog) request from an earlier conversation is over → the bot starts fresh.
  if (before?.status === GENERAL_STATUS && startsNewSession(before.lastInboundAt, at)) {
    await prisma.waBotConversation.updateMany({ where: { id: before.id, status: GENERAL_STATUS }, data: { status: "active" } });
    await clearGeneralState(before.id);
  }
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

  let stored: { id: string };
  try {
    stored = await prisma.waBotMessage.create({
      // createdAt = arrival time (ms), not Meta's second-precision timestamp: "latest message" must be unambiguous.
      data: { conversationId: conv.id, role: "user", kind: cls.kind, text: text.slice(0, 4000), waMessageId: m.id! },
      select: { id: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null; // Meta retry
    throw err;
  }
  // Item 39: the WhatsApp media id of a photo / video / file, so the bot and the rep can open it.
  if ((cls.kind === "image" || cls.kind === "media") && cls.mediaId) {
    await saveMediaRef(conv.id, { messageId: stored.id, mediaId: cls.mediaId, mimeType: cls.mimeType ?? null, label: cls.kind === "image" ? "תמונה" : cls.label }, m.id!);
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
  // Or, 27/10: the customer is back after the partial closing → active again (the rep is told in processInbound).
  let resumedFromPartial = false;
  if (conv.status === CLOSED_PARTIAL_STATUS) {
    const flipped = await prisma.waBotConversation.updateMany({
      where: { id: conv.id, status: CLOSED_PARTIAL_STATUS },
      data: { status: "active" },
    });
    resumedFromPartial = flipped.count > 0;
    if (resumedFromPartial) console.log(`${LOG} ${maskPhone(phone)} back after the partial closing — active again`);
  }
  // active → the bot answers; handoff → alert to the rep + one "קיבלנו" (processInbound decides).
  return {
    conversationId: conv.id,
    waMessageId: m.id!,
    ...(voice ? { voice } : {}),
    ...(image ? { image } : {}),
    ...(resumedFromPartial ? { resumedFromPartial } : {}),
  };
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
    if (item.resumedFromPartial) await onPartialResume(item.conversationId);
    if (item.voice) {
      // Transcribe first (each voice note in its own run); the reply waits for it (waitForVoiceTranscripts).
      if (state?.status !== "handoff") await markReadWithTyping(item.waMessageId);
      await transcribeVoiceNote(item, item.voice);
    }
    if (item.image) {
      if (state?.status !== "handoff") await markReadWithTyping(item.waMessageId);
      await describeImageMessage(item, item.image);
    }
    if (state?.status === GENERAL_STATUS) {
      // Item 40.1: a general request (not about the caller's dog) — its own short flow.
      await markReadWithTyping(item.waMessageId);
      const isLatest = await waitForQuiet({
        myMessageId: item.waMessageId,
        latestInboundId: () => latestInboundId(item.conversationId),
        sleep,
      });
      if (isLatest) await handleGeneralFollowup(item);
      return;
    }
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
    // Item 31: alert Or + a fallback answer to the customer + an urgent task — nobody is left unanswered.
    await failSafeReply(item, err);
  }
}

/**
 * The bot failed (Claude / Anthropic error, bad key, no credit, timeout, a DB error…): Or gets an
 * alert, the customer gets botFallbackText() (once per 30 min per conversation, only while the bot
 * may still write to them) and a rep gets an URGENT task. Never throws.
 */
async function failSafeReply(item: PendingInbound, err: unknown): Promise<void> {
  try {
    const conv = await prisma.waBotConversation.findUnique({ where: { id: item.conversationId } }).catch(() => null);
    await alertAllDogFailure({ kind: "bot_reply", error: err, phone: conv?.phone ?? null, leadId: conv?.leadId ?? null });
    if (!conv || !(await claimOnce(`alldog-bot-fallback:${conv.id}`, 30 * 60))) return;
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
    if (conv.status === "active" && botMayReply(conv)) {
      const text = botFallbackText(await conversationGender(conv));
      const wamid = await sendText(conv.phone, text);
      if (wamid) {
        await prisma.waBotMessage
          .create({ data: { conversationId: conv.id, role: "assistant", text, waMessageId: wamid } })
          .catch(() => {});
      }
    }
    await createDbExecutor(ref).saveLead({}).catch(() => {});
    if (ref.leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: ref.leadId, businessId: ref.businessId }, select: { name: true } });
      const name = lead && !isPlaceholderLeadName(lead.name) ? lead.name : ref.profileName || maskPhone(ref.phone);
      await createLeadTask(ref.businessId, ref.leadId, {
        title: `דחוף: הבוט לא הצליח לענות – לחזור ל${name}`,
        description: [
          "הבוט בוואטסאפ נכשל בתשובה ללקוח, והלקוח קיבל הודעה שנציגה תחזור אליו.",
          `סיבה: ${explainFailure(err)}`,
          "השיחה בוואטסאפ: כרטיס הליד → וואטסאפ עם הבוט.",
        ].join("\n"),
        priority: "URGENT",
      });
    }
  } catch (e) {
    console.error(`${LOG} fail-safe failed:`, e instanceof Error ? e.message : e);
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
  await dropDeletedLeadLink(ref);
  await waitForVoiceTranscripts(conv.id);

  // The current conversation only: after a long silence the customer starts over (item 30c).
  const rows = currentSession(
    (
      await prisma.waBotMessage.findMany({
        where: { conversationId: conv.id, role: { not: "system" } }, // system = automation markers (item 32)
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 40,
        select: { id: true, role: true, kind: true, text: true, createdAt: true },
      })
    )
      .reverse()
      .map(displayMissedCallMessage) // legacy technical copies → the template text the customer got
  );
  // Item 32: the customer answers our automatic missed-call message → no forced opening, context note.
  const missedCallSent = await prisma.waBotMessage.findFirst({
    where: { conversationId: conv.id, role: "system", kind: MISSED_CALL_KINDS.sent, createdAt: { gte: new Date(Date.now() - MISSED_CALL_DEDUP_MS) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const answeringMissedCall =
    !!missedCallSent &&
    !rows.some((r) => r.role === "assistant" && r.createdAt > missedCallSent.createdAt && !isMissedCallTemplateMessage(r));
  // Item 34: the customer answers our website-form message → no opening, the form's details are known.
  const formLeadSent = rows.find((r) => r.role === "assistant" && r.kind === FORM_LEAD_MESSAGE_KIND);
  const answeringFormLead =
    !!formLeadSent && !rows.some((r) => r.role === "assistant" && r.createdAt > formLeadSent.createdAt && r.kind !== FORM_LEAD_MESSAGE_KIND);
  const automaticOpening = answeringMissedCall || answeringFormLead;
  // What the customer typed — a name from a voice note alone is not saved as the lead's name (item 30d).
  ref.typedTexts = rows.filter((r) => r.role === "user" && r.kind === "text").map((r) => r.text);
  /** What the customer said (texts + voice transcripts), oldest first. */
  const userWords = rows.filter((r) => r.role === "user").map(customerWords).filter((t): t is string => !!t);
  const lastAssistant = rows.map((r) => r.role).lastIndexOf("assistant");
  const lastReply = Math.max(lastAssistant, rows.map((r) => r.role).lastIndexOf("human"));
  const batch = rows.slice(lastReply + 1).filter((r) => r.role === "user");
  if (!batch.length) return;

  // Safety case: a person was bitten → the team hears about it NOW, while the bot collects the basics.
  const batchWords = batch.map(customerWords).filter((t): t is string => !!t);
  if (!handoffMode && batchWords.some((t) => mentionsHumanBite(t))) {
    await alertBiteReported(ref, batchWords);
  }

  // "דחוף" / "בהקדם" / "השכנים מתלוננים" → the lead is marked urgent with the reason (Or, 24/10 12:58).
  for (const t of batchWords) {
    const why = urgencyReason(t);
    if (why) {
      await markUrgentSafe(ref, why, t);
      break;
    }
  }

  // Only voice notes that could not be transcribed → "write it briefly" (once in a row; item 28a).
  if (batch.every((r) => isVoiceFailed(r))) {
    if (lastAssistant >= 0 && rows[lastAssistant].text === VOICE_FAILED_REPLY) return;
    await sendParts(item, conv.phone, [VOICE_FAILED_REPLY], handoffMode);
    return;
  }
  const hadFailedVoice = batch.some((r) => isVoiceFailed(r));

  // Item 40 (Or, 28/10): the customer is already in touch with a rep, or writes about something that
  // is not their dog (owner, supplier, job, collaboration, invoice / complaint, their own trainer)
  // → no dog questions; a bite always goes the normal (safety) way.
  if (!handoffMode && batchWords.length && !userWords.some((t) => mentionsHumanBite(t))) {
    const joined = batchWords.join("\n");
    const gender0 = detectGender({ texts: userWords, name: conv.profileName });
    if (repCallbackMissed(joined)) {
      await onRepCallbackMissed(item, ref, joined, gender0);
      return;
    }
    const withRep = alreadyWithRep(joined);
    if (withRep) {
      await onAlreadyWithRep(item, ref, withRep, joined);
      return;
    }
    const kind = generalInquiryKind(joined);
    if (kind) {
      const earlier = rows
        .slice(0, lastReply + 1)
        .filter((r) => r.role === "user")
        .map(customerWords)
        .filter((t): t is string => !!t);
      const existingCustomerMatter = kind === "own_trainer" || kind === "billing" || kind === "complaint";
      if (!earlier.some(mentionsDogNeed) || (existingCustomerMatter && lastAssistant < 0)) {
        await startGeneralInquiry(item, conv, kind, batchWords, gender0);
        return;
      }
    }
  }

  // Item 39: a video / file the bot cannot open → "תודה ששלחת 🙂 צירפתי לפרטים בשביל הנציגה" + the
  // next question (never "I only read text"); the rep gets a task to look at it.
  const batchMedia = batch.filter((r) => r.kind === "media");
  if (batchMedia.length === batch.length && handoffMode) return; // the rep already got the alert
  if (!handoffMode && batchMedia.length) {
    const mediaRefs = await mediaRefsFor(conv.id, batchMedia.map((r) => r.id));
    for (const r of batchMedia.slice(-3)) await flagMediaForHuman(ref, mediaLabelOf(r.text), mediaRefs.has(r.id) ? r.id : undefined, captionOf(r.text));
  }

  // Item 39: the photos of this batch go to the model as images (max 3); a failed download → as if a file.
  const batchImages = batch.filter((r) => r.kind === "image").slice(-3);
  const imageBlocks: Anthropic.ImageBlockParam[] = [];
  let unreadableImage = false;
  if (batchImages.length) {
    const refs = await mediaRefsFor(conv.id, batchImages.map((r) => r.id));
    for (const r of batchImages) {
      const mref = refs.get(r.id);
      const file = mref ? await downloadMedia(mref.mediaId).catch(() => null) : null;
      const block = file ? imageBlockFor(file, mref?.mimeType) : null;
      if (block) imageBlocks.push(block);
      else unreadableImage = true;
    }
  }
  const unreadable = batchMedia.length > 0 || unreadableImage;

  const history: Anthropic.MessageParam[] = toChatTurns(
    rows.map((r) => ({
      role: r.role,
      text:
        r.kind === "media"
          ? `(הלקוח שלח ${mediaLabelOf(r.text)}${captionOf(r.text) ? ` עם הכיתוב: ${captionOf(r.text)}` : ""})`
          : r.kind === "image"
            ? imageHistoryText(r.text)
            : r.kind === "voice"
              ? isVoiceFailed(r)
                ? "[הודעה קולית שלא הצלחת לשמוע]"
                : voiceHistoryText(r.text)
              : r.text,
    }))
  );
  if (!history.length || history[history.length - 1].role !== "user") return;

  // Item 39 addition: the guide is offered, not sent. A pending offer + "כן" → the link; anything else → never again.
  const batchText = batchWords.join("\n");
  const offer = await readOffer(conv.id);
  let guideToSend: KnowledgeEntry | null = null;
  if (offer?.state.status === "pending") {
    const entry = guideBySlug(offer.state.slug);
    if (entry && isYesToOffer(batchText)) {
      await setOfferStatus(offer.id, { slug: entry.slug, status: "accepted" });
      if (isOnlyYes(batchText) && !imageBlocks.length && !unreadable) {
        // Just "כן" → the link + one line, no model turn, no more questions about the guide.
        await sendParts(item, conv.phone, [guideLinkMessage(entry)], handoffMode, [GUIDE_LINK_MESSAGE_KIND]);
        return;
      }
      guideToSend = entry;
    } else {
      await setOfferStatus(offer.id, { slug: offer.state.slug, status: "declined" });
    }
  } else if (!offer && !handoffMode && asksForReading(batchText)) {
    // The customer asked for something to read → straight away, no offer.
    const entry = (await rememberedGuide(conv.id)) ?? preciseGuideFor(userWords.join(" "));
    if (entry && (await claimOffer(conv.id, { slug: entry.slug, status: "sent" }))) guideToSend = entry;
  }
  if (imageBlocks.length) {
    const last = history[history.length - 1];
    last.content = [...imageBlocks, { type: "text", text: typeof last.content === "string" ? last.content : "" }];
  }

  // The name of the lead this contact belongs to now: an old / closed lead does not count
  // (a returning caller gets a new lead, named from this conversation — Or, item 24).
  let knownName: string | null = null;
  const activeLead = await findLeadByPhone(conv.businessId, conv.phone).catch(() => null);
  if (activeLead && !isPlaceholderLeadName(activeLead.name)) knownName = activeLead.name;
  const priorBotTexts = rows.filter((r) => r.role === "assistant").map((r) => r.text);
  // A name heard only in a voice note is not used to address the customer until confirmed (item 29d).
  const voiceName = voiceOnlyName({
    name: knownName,
    typedTexts: rows.filter((r) => r.role === "user" && r.kind === "text").map((r) => r.text),
    voiceTexts: rows.filter((r) => r.role === "user" && r.kind === "voice").map(customerWords).filter((t): t is string => !!t),
    profileName: conv.profileName,
    priorBotTexts,
  });
  if (voiceName) knownName = null;
  // How to address this customer (item 25): gender from their own words + name, plural only if they use it.
  const style = addressStyleFor({
    texts: userWords,
    name: knownName ?? conv.profileName,
  });
  ref.gender = style.gender;
  ref.transitionSent = rows.some((r) => r.role === "assistant" && r.text.includes(TRANSITION_MARKER));
  // An attack / bite was described → no "מעולה" in the closing (item 29c).
  ref.serious = isSeriousIncident(userWords);
  // Item 39 update: the breed the owner gave (lead pet notes "גזע: …"), an earlier photo in this conversation, a breed-guess question.
  const ownerBreed = /(?:^|\n)גזע:\s*([^\n]+)/u.exec(activeLead?.notes ?? "")?.[1]?.trim() || null;
  const earlierPhoto = rows.slice(0, rows.length - batch.length).some((r) => r.role === "user" && r.kind === "image");
  const breedGuessAsked = asksBreedGuess(batchWords.join("\n"));
  // "באלו מקרני שומרון" = a name + the city; never asked again (item 29b).
  const namePlace = batchWords.map(namePlaceNote).find(Boolean) ?? null;
  const known = {
    // Item 34: the website form already gave the city → never asked again.
    city: (!!formLeadSent && !!activeLead?.city) || cityAlreadyGiven(rows.map((r) => ({ role: r.role, text: customerWords(r) ?? r.text }))),
    dogName: batchWords.some((t) => !!parseNamePlace(t)) || userWords.some((t) => !!parseNamePlace(t)),
  };
  // The closing was already sent → answer questions only, never repeat it (Or, 24/10).
  const closed = closingAlreadySent(rows);
  // Item 35a: a caller who seems to be a child → no more personal details, a parent talks to the rep.
  const minor = seemsMinor(userWords);
  // Or, 27/10: back after the partial closing (in this session) → collect only what is missing.
  const partialMissing = rows.length ? await partialClosedMissing(conv.id, rows[0].createdAt) : null;
  const now = new Date();
  const p = israelParts(now);
  const context = buildBotContext({
    nowLabel: `${heDayLabel(p.ymd)} בשעה ${p.hhmm}`,
    attribution: conv.attributionSource || conv.attributionPage ? { source: conv.attributionSource, page: conv.attributionPage } : null,
    knownName,
    isFirstReply: lastAssistant < 0 && !automaticOpening,
    note: [
      handoffMode ? HANDOFF_MODE_NOTE : null,
      closed ? CLOSED_NOTE : null,
      conv.resumedAt && (!conv.lastBotReplyAt || conv.lastBotReplyAt < conv.resumedAt) ? RESUMED_NOTE : null,
      // Any bite reported in this conversation (not only in this batch) until the handoff happens.
      !handoffMode && userWords.some((t) => mentionsHumanBite(t)) ? HUMAN_BITE_NOTE : null,
      imageBlocks.length ? IMAGE_NOTE : null,
      // Item 39 update: the owner's breed wins; one compliment per conversation; never guess a breed.
      imageBlocks.length && ownerBreed ? ownerBreedNote(ownerBreed) : null,
      imageBlocks.length && earlierPhoto ? MORE_PHOTOS_NOTE : null,
      breedGuessAsked ? `הלקוח מבקש שתנחש את הגזע. לא מנחשים: "${BREED_GUESS_ANSWER}"` : null,
      unreadable ? UNREADABLE_MEDIA_NOTE : null,
      hadFailedVoice
        ? `הלקוח שלח גם הודעה קולית שלא הצלחת לשמוע. בקש בעדינות שיכתוב בקצרה מה אמר בה ("${VOICE_FAILED_REPLY}"), בלי להזכיר נציגה.`
        : null,
      namePlace,
      minor ? MINOR_NOTE : null,
      partialMissing && !handoffMode ? partialResumeNote(partialMissing) : null,
      // Item 38: a price question in this batch, no price sent yet → this answer carries a number.
      !handoffMode && batchWords.some((t) => asksPrice(t)) && !pricesAlreadySent(priorBotTexts) ? PRICE_QUESTION_NOTE : null,
      answeringMissedCall ? MISSED_CALL_CONTEXT_NOTE : null,
      formLeadSent && activeLead
        ? formLeadContextNote({ name: activeLead.name, city: activeLead.city, service: activeLead.requestedService })
        : null,
      voiceName ? voiceNameNote(voiceName, priorBotTexts) : null,
      addressNote(style),
    ].filter(Boolean).join("\n") || null,
  });

  const executor = createDbExecutor(ref);
  const result = await runBotTurn({
    client: new Anthropic({ apiKey: allDogAnthropicKey() }),
    model: botModel(),
    context,
    history,
    executor,
    ...(handoffMode ? { tools: HANDOFF_MODE_TOOLS } : {}),
  });

  const latestUserText = batchWords[batchWords.length - 1] ?? "";
  // Item 39: never "I only read text" / "I can't see pictures" / "I'm a bot" (the identity answer to a direct question is re-added below).
  let text = applyAddressStyle(applyConversationGuards(enforceIdentityAnswer(latestUserText, dropLimitationLines(result.reply)), priorBotTexts, {
    userTexts: userWords,
    known,
  }), style);
  text = stripVocativeName(text, voiceName);
  if (ref.serious) text = dropCheerfulOpeners(text);
  // Never "מחוץ לאזור" / "לא ברשימה" — Or's optimistic line instead (item 28b).
  text = fixOutOfAreaLines(text, style.gender, priorBotTexts);
  // Item 40.5: always "נציגת AllDog" calls back — never a promise that a trainer will.
  text = fixWhoCallsBack(text);
  // Item 40.6: a price question (no price sent yet) → the answer carries the numbers.
  if (batchWords.some((t) => asksPrice(t)) && !pricesAlreadySent(priorBotTexts)) text = enforcePriceAnswer(text);
  if (executor.closing && !closed) {
    // After schedule_callback / handoff_to_human the last message is always the fixed closing.
    text = withClosing(text, executor.closing);
  } else if (!handoffMode) {
    const firstUserText = batchWords.join("\n");
    text = enforceOpening(lastAssistant < 0 && !automaticOpening, firstUserText, text);
  }
  // Item 39 update: no "מעורב" / "נראה כמו" in a reply to a photo, and the breed-guess question gets the fixed answer.
  if (imageBlocks.length || breedGuessAsked) text = dropBreedGuesses(text);
  text = enforceBreedAnswer(batchWords.join("\n"), text);
  // Item 39.6: "היי" / "שלום" only in the very first reply.
  text = dropMidConversationGreeting(text, lastAssistant < 0 && !automaticOpening);
  // Item 39.4: a file the bot could not open → the reply opens with the thank-you line.
  if (unreadable && text && !text.includes("תודה ששלחת") && !imageBlocks.length) text = `${MEDIA_REPLY}\n${text}`;
  let afterHandoff = result.handedOff || handoffMode;
  if (!text && result.reply.trim() && !executor.closing) {
    // Everything the model wrote was already sent earlier in this conversation (item 26a) → say nothing.
    console.log(`${LOG} reply repeated an earlier bot message — not sent (${maskPhone(conv.phone)})`);
    return;
  }
  if (!text) {
    if (handoffMode) return;
    if (!result.handedOff) {
      // Refusal / empty answer: a person takes over rather than the customer being ignored.
      await createDbExecutor(ref).handoff({ reason: `הבוט לא הצליח לענות (${result.stopReason ?? "ללא תשובה"})`, urgency: "normal" });
      text = handoffClosingText(await closingWhenNow(conv.businessId), style.gender, { serious: ref.serious });
      afterHandoff = true;
    } else {
      return;
    }
  }

  if (minor && ref.leadId) await updateConversationLog(ref, ref.leadId, (current) => withFact(current, MINOR_FACT));

  // Item 39 addition: guide links never come from the model; a precise guide is offered once the basics are in.
  text = stripGuideLinks(text);
  if (executor.guideSlug) await rememberGuide(conv.id, executor.guideSlug);
  const extraParts: string[] = [];
  const extraKinds: string[] = [];
  if (guideToSend) {
    extraParts.push(guideLinkMessage(guideToSend));
    extraKinds.push(GUIDE_LINK_MESSAGE_KIND);
  } else if (!offer && !handoffMode && !minor && !ref.serious && !userWords.some((t) => mentionsHumanBite(t))) {
    const entry = executor.guideSlug ? guideBySlug(executor.guideSlug) : await rememberedGuide(conv.id);
    const basics = !!executor.closing || closed || (await leadHasBasics(ref));
    if (entry && basics && (await claimOffer(conv.id, { slug: entry.slug, status: "pending" }))) {
      extraParts.push(guideOfferText(style.gender, conv.id));
      extraKinds.push(GUIDE_OFFER_MESSAGE_KIND);
    }
  }

  // A newer message arrived while the model was thinking → its own run will answer.
  if ((await latestInboundId(conv.id)) !== item.waMessageId) return;
  // Closing turn: the bot's answer · transition + closing = 2 messages (item 35); the guide offer / link on its own after them.
  const mainParts = text ? splitReply(text, 2) : [];
  await sendParts(item, conv.phone, [...mainParts, ...extraParts], afterHandoff, [...mainParts.map(() => "text"), ...extraKinds]);
  // The conversation just ended (closing / handoff) → one summary in the lead journal (item 27i).
  if ((executor.closing && !closed) || (afterHandoff && !handoffMode)) await summarizeBotConversation(conv.id);
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
  await waitForVoiceTranscripts(conv.id);
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
    await dropDeletedLeadLink(ref);
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

  // Item 40.2: "התקשרתי חזרה ולא ענו" → an URGENT task + one question; "אני איתה בטלפון" → one line;
  // details while already with a rep → "רשמתי, היא תראה את זה 🙏" (no summary back to them).
  const joined = texts.join("\n");
  const lastBot = await lastBotText(conv.id);
  if (repCallbackMissed(joined)) {
    const gender = await conversationGender(conv);
    if (await claimOnce(`alldog-rep-missed:${conv.id}`, 60 * 60)) {
      await repMissedTask({ businessId: conv.businessId, leadId: ref.leadId, name: await displayName(ref), phone: conv.phone, text: joined });
    }
    await markWithRep(conv.id, "missed");
    if (lastBot !== repMissedLine(gender)) await sendParts(item, conv.phone, [repMissedLine(gender)], true);
    return;
  }
  const withRepNow = alreadyWithRep(joined);
  if (withRepNow) {
    if (ref.leadId) await addLeadCallLog(ref.leadId, `${WITH_REP_LOG}: "${joined.replace(/\s+/g, " ").slice(0, 300)}"`).catch(() => {});
    await markWithRep(conv.id, withRepNow);
    const line = withRepNow === "met" ? WITH_REP_MET_LINE : WITH_REP_LINE;
    if (lastBot !== line) await sendParts(item, conv.phone, [line], true);
    return;
  }
  // "I want a person" → one fixed line, at most once per 6 hours; nothing more.
  if (texts.some((t) => isHumanRequest(t))) {
    if (!handoffAckDue(conv, now)) return;
    const ack = await prisma.waBotConversation.updateMany({
      where: { id: conv.id, status: "handoff", handoffAckAt: conv.handoffAckAt },
      data: { handoffAckAt: now },
    });
    if (ack.count > 0) await sendParts(item, conv.phone, [humanOnTheWay(await conversationGender(conv))], true);
    return;
  }
  // The customer told us they are with a rep → details get one short ack (they are in the lead journal already).
  if ((await isWithRep(conv.id, conv.handoffAt)) && !texts.some((t) => isQuestion(t))) {
    if (lastBot !== WITH_REP_DETAILS_ACK) await sendParts(item, conv.phone, [WITH_REP_DETAILS_ACK], true);
    return;
  }
  // Anything else: the bot keeps helping (general questions, new details → the lead).
  await reply(item, "handoff");
}

/** The customer's gender for a fixed line sent outside reply() (item 25). */
async function conversationGender(conv: { id: string; businessId: string; phone: string; profileName: string | null }): Promise<Gender> {
  try {
    const texts = (
      await prisma.waBotMessage.findMany({
        where: { conversationId: conv.id, role: "user", kind: { in: ["text", "voice"] } },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: { kind: true, text: true },
      })
    )
      .map(customerWords)
      .filter((t): t is string => !!t);
    const lead = await findLeadByPhone(conv.businessId, conv.phone).catch(() => null);
    const name = lead && !isPlaceholderLeadName(lead.name) ? lead.name : conv.profileName;
    return detectGender({ texts, name });
  } catch {
    return "unknown";
  }
}

async function markUrgentSafe(ref: BotConversationRef, reason: string, quote: string): Promise<void> {
  try {
    await createDbExecutor(ref).markUrgent?.(reason, quote);
  } catch (err) {
    console.error(`${LOG} mark urgent failed:`, err instanceof Error ? err.message : err);
  }
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

async function sendParts(item: PendingInbound, to: string, parts: string[], allowAfterHandoff = false, kinds: string[] = [], allowGeneral = false): Promise<void> {
  for (const [i, part] of parts.entries()) {
    const conv = await prisma.waBotConversation.findUnique({
      where: { id: item.conversationId },
      select: { status: true, lastInboundAt: true },
    });
    if (!conv) return;
    // Re-checked before every message: stop/handoff in the meantime, and never outside 24h.
    const statusOk =
      conv.status === "active" || (allowAfterHandoff && conv.status === "handoff") || (allowGeneral && conv.status === GENERAL_STATUS);
    if (!statusOk || !botMayReply({ status: "active", lastInboundAt: conv.lastInboundAt })) return;

    await markReadWithTyping(item.waMessageId);
    await sleep(typingDelayMs(part));
    if ((await latestInboundId(item.conversationId)) !== item.waMessageId) return;

    const wamid = await sendText(to, part);
    if (!wamid) return;
    await prisma.waBotMessage.create({
      data: { conversationId: item.conversationId, role: "assistant", kind: kinds[i] ?? "text", text: part, waMessageId: wamid },
    });
    await prisma.waBotConversation.update({ where: { id: item.conversationId }, data: { lastBotReplyAt: new Date() } });
  }
}

/** Item 39 addition: the basics are in (city + the dog's name on the lead) → the guide may be offered. */
async function leadHasBasics(ref: BotConversationRef): Promise<boolean> {
  if (!ref.leadId) return false;
  const lead = await prisma.lead.findFirst({ where: { id: ref.leadId, businessId: ref.businessId }, select: { city: true, notes: true } });
  return !!lead?.city?.trim() && /(?:^|\n)שם:\s*\S/u.test(lead.notes ?? "");
}

// ─── Photos (Or, item 39) ─────────────────────────────────────────────────────

function appBase(): string {
  return (process.env.APP_URL || "https://petra-app.com").replace(/\/$/, "");
}

/**
 * Download + describe one photo; the description replaces "[תמונה]" in its WaBotMessage and the
 * lead journal gets "[וואטסאפ · בוט] 📷 תמונה · <what is in it>" + a link the rep opens in Petra.
 * A failure leaves "[תמונה]" (the reply then thanks + goes on, never exposing a limitation). Never throws.
 */
async function describeImageMessage(item: PendingInbound, image: { mediaId: string; mimeType: string | null; caption: string | null }): Promise<void> {
  let description: string | null = null;
  try {
    const file = await downloadMedia(image.mediaId);
    const block = file ? imageBlockFor(file, image.mimeType) : null;
    if (block) {
      const d = await describeImage(block, image.caption);
      description = d ? descriptionLine(d) : null;
    }
  } catch (err) {
    console.error(`${LOG} image description failed:`, err instanceof Error ? err.message.slice(0, 200) : "error");
  }
  const row = await prisma.waBotMessage.findFirst({
    where: { conversationId: item.conversationId, waMessageId: item.waMessageId, kind: "image" },
    select: { id: true, text: true },
  });
  if (!row) return;
  if (description) {
    await prisma.waBotMessage.update({ where: { id: row.id }, data: { text: imageMessageText(description, parseImageMessageText(row.text).caption) } });
  }
  try {
    const conv = await prisma.waBotConversation.findUnique({ where: { id: item.conversationId } });
    if (!conv) return;
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
    await dropDeletedLeadLink(ref);
    if (conv.status === GENERAL_STATUS) return; // item 40.1: never a lead for a general request
    await createDbExecutor(ref).saveLead({});
    if (ref.leadId) {
      await addLeadCallLog(
        ref.leadId,
        mediaLogText({ label: "תמונה", description, caption: image.caption, url: `${appBase()}/api/leads/${ref.leadId}/whatsapp-bot/media/${row.id}` })
      );
    }
    console.log(`${LOG} photo ${description ? "described" : "not described"} (${maskPhone(conv.phone)})`);
  } catch (err) {
    console.error(`${LOG} photo log failed:`, err instanceof Error ? err.message : err);
  }
}

// ─── Voice notes (Or, item 28a) ───────────────────────────────────────────────

/**
 * Download + transcribe one voice note (ElevenLabs Scribe, Hebrew) and store the transcript in its
 * WaBotMessage (kind "voice"). The lead journal gets the transcript + the WhatsApp media id.
 * Failure → VOICE_FAILED_TEXT (the bot then asks the customer to write it briefly). Never throws.
 */
async function transcribeVoiceNote(item: PendingInbound, voice: { mediaId: string; mimeType: string | null }): Promise<void> {
  let transcript: string | null = null;
  let failure: unknown = null;
  try {
    const audio = await downloadMedia(voice.mediaId);
    if (audio) {
      const t = await transcribeAudio(
        { data: audio.data, contentType: voice.mimeType || audio.contentType, filename: "voice.ogg" },
        { language: "he", diarize: false, timeoutMs: 30_000 }
      );
      transcript = cleanTranscript(t.text);
    } else {
      failure = "הורדת ההקלטה מ-WhatsApp נכשלה";
    }
  } catch (err) {
    failure = err;
    console.error(`${LOG} voice transcription failed:`, err instanceof Error ? err.message.slice(0, 200) : "error");
  }
  if (failure) {
    // Item 31 (an empty transcript = silence, not a failure).
    const conv = await prisma.waBotConversation.findUnique({ where: { id: item.conversationId }, select: { phone: true, leadId: true } }).catch(() => null);
    await alertAllDogFailure({ kind: "transcription", error: failure, detail: "הודעה קולית בבוט", phone: conv?.phone ?? null, leadId: conv?.leadId ?? null });
  }
  await prisma.waBotMessage.updateMany({
    where: { conversationId: item.conversationId, waMessageId: item.waMessageId, kind: "voice", text: VOICE_PENDING_TEXT },
    data: { text: transcript ?? VOICE_FAILED_TEXT },
  });
  try {
    const conv = await prisma.waBotConversation.findUnique({ where: { id: item.conversationId } });
    if (!conv) return;
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
    await dropDeletedLeadLink(ref);
    if (conv.status === GENERAL_STATUS) return; // item 40.1: never a lead for a general request
    await createDbExecutor(ref).saveLead({});
    if (ref.leadId) await addLeadCallLog(ref.leadId, voiceNoteLogText(voice.mediaId, transcript));
    console.log(`${LOG} voice note ${transcript ? "transcribed" : "not transcribed"} (${maskPhone(conv.phone)})`);
  } catch (err) {
    console.error(`${LOG} voice note log failed:`, err instanceof Error ? err.message : err);
  }
}

/** The reply waits until every voice note of the last minutes is transcribed (max ~45s). */
async function waitForVoiceTranscripts(conversationId: string): Promise<void> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const pending = await prisma.waBotMessage.findFirst({
      where: { conversationId, role: "user", kind: "voice", text: VOICE_PENDING_TEXT, createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
      select: { id: true },
    });
    if (!pending) return;
    await sleep(1500);
  }
}

// ─── Item 40 (Or, 28/10): general requests + a customer already with a rep ────

async function lastBotText(conversationId: string): Promise<string | null> {
  const row = await prisma.waBotMessage.findFirst({
    where: { conversationId, role: "assistant" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { text: true },
  });
  return row?.text ?? null;
}

async function displayName(ref: BotConversationRef): Promise<string> {
  const lead = ref.leadId ? await prisma.lead.findFirst({ where: { id: ref.leadId, businessId: ref.businessId }, select: { name: true } }) : null;
  return lead && !isPlaceholderLeadName(lead.name) ? lead.name : ref.profileName || maskPhone(ref.phone);
}

/** "אני איתה בטלפון" / "רחלי חזרה אליי וקבענו": one line, a journal line, the conversation goes to the rep. */
async function onAlreadyWithRep(item: PendingInbound, ref: BotConversationRef, kind: "talking" | "met", text: string): Promise<void> {
  await createDbExecutor(ref).saveLead({}).catch(() => {});
  if (ref.leadId) await addLeadCallLog(ref.leadId, `${WITH_REP_LOG}: "${text.replace(/\s+/g, " ").slice(0, 300)}"`).catch(() => {});
  await markWithRep(ref.id, kind);
  await handToRep(ref.id);
  console.log(`${LOG} ${maskPhone(ref.phone)} already with a rep (${kind}) — handed over`);
  await sendParts(item, ref.phone, [kind === "met" ? WITH_REP_MET_LINE : WITH_REP_LINE], true);
}

/** "התקשרתי חזרה ולא ענו": URGENT task for the rep + one question about a good time; the answer goes to the rep. */
async function onRepCallbackMissed(item: PendingInbound, ref: BotConversationRef, text: string, gender: Gender): Promise<void> {
  await createDbExecutor(ref).saveLead({}).catch(() => {});
  if (await claimOnce(`alldog-rep-missed:${ref.id}`, 60 * 60)) {
    await repMissedTask({ businessId: ref.businessId, leadId: ref.leadId, name: await displayName(ref), phone: ref.phone, text });
  }
  await markWithRep(ref.id, "missed");
  await handToRep(ref.id);
  console.log(`${LOG} ${maskPhone(ref.phone)} could not reach the rep — urgent task`);
  await sendParts(item, ref.phone, [repMissedLine(gender)], true);
}

async function sessionTranscript(conversationId: string): Promise<Array<{ role: string; text: string }>> {
  return currentSession(
    (
      await prisma.waBotMessage.findMany({
        where: { conversationId, role: { not: "system" } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 30,
        select: { id: true, role: true, kind: true, text: true, createdAt: true },
      })
    ).reverse()
  ).map((r) => ({ role: r.role, text: customerWords(r) ?? r.text }));
}

/** Start a general request: status "general" (no lead, no nudge, no summary), then ONE question or the closing. */
async function startGeneralInquiry(
  item: PendingInbound,
  conv: { id: string; businessId: string; phone: string; profileName: string | null },
  kind: GeneralKind,
  batchWords: string[],
  gender: Gender
): Promise<void> {
  const contact = await generalContact(conv, batchWords);
  const joined = batchWords.join(" ");
  const missing = { topic: generalTopicMissing(kind, joined), name: !contact.name };
  await prisma.waBotConversation.update({ where: { id: conv.id }, data: { status: GENERAL_STATUS } });
  const state: GeneralState = {
    kind,
    stage: "asked",
    name: contact.name,
    topic: missing.topic ? null : joined,
    asked: missing,
    taskId: null,
    ackSent: false,
    at: new Date().toISOString(),
  };
  console.log(`${LOG} ${maskPhone(conv.phone)} general request (${kind})`);
  const question = generalQuestion(missing);
  if (question) {
    await saveGeneralState(conv.id, state);
    await sendParts(item, conv.phone, [question], false, [], true);
    return;
  }
  await closeGeneralInquiry(item, conv, state, gender, batchWords);
}

async function closeGeneralInquiry(
  item: PendingInbound,
  conv: { id: string; businessId: string; phone: string; profileName: string | null },
  state: GeneralState,
  gender: Gender,
  texts: string[]
): Promise<void> {
  await saveGeneralState(conv.id, { ...state, stage: "closed" });
  await sendParts(item, conv.phone, [generalClosingFor(state.kind, gender, conv.id, texts)], false, [], true);
  const taskId = await finishGeneralInquiry({
    conv,
    kind: state.kind,
    name: state.name,
    topic: state.topic ?? GENERAL_KIND_LABELS[state.kind],
    transcript: await sessionTranscript(conv.id),
  });
  await saveGeneralState(conv.id, { ...state, stage: "closed", taskId });
}

/** A message in a conversation that is a general request (status "general"). */
async function handleGeneralFollowup(item: PendingInbound): Promise<void> {
  const conv = await prisma.waBotConversation.findUnique({ where: { id: item.conversationId } });
  if (!conv || conv.status !== GENERAL_STATUS) return;
  if (!isWithin24hWindow(conv.lastInboundAt)) return;
  await waitForVoiceTranscripts(conv.id);
  const transcript = await sessionTranscript(conv.id);
  const lastBot = transcript.map((m) => m.role).lastIndexOf("assistant");
  const batch = transcript.slice(lastBot + 1).filter((m) => m.role === "user").map((m) => m.text).filter(Boolean);
  if (!batch.length) return;
  const state = await readGeneralState(conv.id);
  const userTexts = transcript.filter((m) => m.role === "user").map((m) => m.text);
  const gender = detectGender({ texts: userTexts, name: conv.profileName });
  // It turns out a dog needs help after all → back to the normal flow (Or).
  if (!state || batch.some(mentionsDogNeed)) {
    await prisma.waBotConversation.updateMany({ where: { id: conv.id, status: GENERAL_STATUS }, data: { status: "active" } });
    if (state?.taskId) await appendToGeneralTask(conv.businessId, state.taskId, batch);
    console.log(`${LOG} ${maskPhone(conv.phone)} general request → a dog after all, back to the normal flow`);
    await reply(item);
    return;
  }
  if (state.stage === "asked") {
    // The one question was asked → close now, whatever came back (no second question).
    const joined = batch.join(" ");
    const shortReply = joined.split(/\s+/).length <= 3 && !/\d/.test(joined);
    const name = state.name ?? typedNameOf(joined) ?? (state.asked.name && !state.asked.topic && shortReply ? joined.replace(/[.!?,🙂🙏]/gu, "").trim() : null);
    const topic = state.topic ?? joined;
    await closeGeneralInquiry(item, conv, { ...state, name, topic }, gender, userTexts);
    return;
  }
  // Closed: more words go to the task; one short "רשמתי" (no questions, no follow-up).
  await appendToGeneralTask(conv.businessId, state.taskId, batch);
  if (!state.ackSent) {
    await saveGeneralState(conv.id, { ...state, ackSent: true });
    await sendParts(item, conv.phone, [GENERAL_FOLLOWUP_ACK], false, [], true);
  }
}
