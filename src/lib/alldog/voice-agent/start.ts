/**
 * AllDog voice agent — the call-start lookup (POST /api/webhooks/alldog-voice/start).
 *
 * Records the call (VoiceAgentCall, idempotent on the ElevenLabs conversation id), recognizes the
 * caller with the same matchers as the bot and PayCall (resolveLeadForContact + findCustomersByPhone)
 * and returns 6 free sales-call slots. Never creates a lead. Two DB rounds, no per-day loop:
 *   round 1 (parallel): call upsert · lead lookup · customer lookup · WhatsApp conversation ·
 *                       scheduled LeadMeetings in range · blocking AvailabilityBlocks in range
 *   round 2 (parallel, only when needed): stage name · the lead's next meeting · WhatsApp summary line · link the lead
 * WaBot tables are only READ (the bot's summary line), never written.
 */
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { findCustomersByPhone } from "@/services/clients";
import { isPlaceholderLeadName, localPhone, resolveLeadForContact } from "@/lib/alldog/leads";
import { parsePetNotesBlock } from "@/lib/lead-pet-notes";
import { israelInstant, israelYmd } from "@/lib/alldog/time";
import { toWaId } from "@/lib/alldog/missed-call-rules";
import {
  SALES_BLOCK_WORDS,
  meetingInterval,
  pickSalesSlots,
  salesRange,
  salesWorkdays,
  spokenSlotLabel,
  type Interval,
  type SalesSlot,
} from "@/lib/alldog/voice-agent/slots";

export interface VoiceStartInput {
  conversationId: string;
  callerPhone?: string | null;
  externalCallId?: string | null;
}

export interface VoiceStartResult {
  known: boolean;
  isCustomer: boolean;
  /** Only an old lead (closed, or no contact for 60 days) — the booking will open a new one ("פונה חוזר"). */
  returning: boolean;
  name: string | null;
  dogName: string | null;
  stage: string | null;
  upcomingMeeting: { ymd: string; hhmm: string; label: string } | null;
  whatsappSummary: string | null;
  slots: SalesSlot[];
}

export interface VoiceStartTimings { round1Ms: number; round2Ms: number; totalMs: number }

const WHATSAPP_SUMMARY_MAX = 300;
const HIDDEN_RE = /anonymous|restricted|private|unknown|חסוי|חסום/i;

/** The caller's number as Petra matches it ("0XXXXXXXXX"), or null for a missing / hidden / unusable id. */
export function callerPhoneNormOf(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t || HIDDEN_RE.test(t)) return null;
  const norm = localPhone(t);
  return norm.length >= 9 && norm.length <= 10 ? norm : null;
}

/** The bot's journal / summary line → one short spoken-friendly line (no header, bullets or links). */
export function whatsappSummaryText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw
    .split("\n")
    .map((l) =>
      l
        .replace(/^\[וואטסאפ · בוט\]\s*/, "")
        .replace(/^סיכום שיחה\s*(\([^)]*\))?\s*:?\s*/, "")
        .replace(/^•\s*/, "")
        .replace(/https?:\/\/\S+/g, "")
        .trim()
    )
    // A label left empty once its link was removed ("מדריך:") says nothing on a call.
    .filter((l) => l && l !== "שיחה בוואטסאפ" && !/:$/.test(l))
    .join(" · ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!text) return null;
  return text.length > WHATSAPP_SUMMARY_MAX ? `${text.slice(0, WHATSAPP_SUMMARY_MAX - 1).trimEnd()}…` : text;
}

/** Create the call row once; a repeated start returns the existing row (unique providerConversationId). */
async function upsertCall(businessId: string, input: VoiceStartInput, callerPhoneNorm: string | null, now: Date) {
  const where = { providerConversationId: input.conversationId };
  try {
    return await prisma.voiceAgentCall.upsert({
      where,
      create: {
        businessId,
        providerConversationId: input.conversationId,
        callerPhone: input.callerPhone?.trim() || null,
        callerPhoneNorm,
        externalCallId: input.externalCallId?.trim() || null,
        startedAt: now,
      },
      update: {},
      select: { id: true, leadId: true },
    });
  } catch (e) {
    // Two starts racing on the same conversation id: the loser reads the winner's row.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return prisma.voiceAgentCall.findUniqueOrThrow({ where, select: { id: true, leadId: true } });
    }
    throw e;
  }
}

export async function startVoiceCall(
  businessId: string,
  input: VoiceStartInput,
  now: Date = new Date()
): Promise<{ result: VoiceStartResult; timings: VoiceStartTimings }> {
  const t0 = performance.now();
  const phone = callerPhoneNormOf(input.callerPhone);
  const days = salesWorkdays(now);
  const range = salesRange(days);

  const [call, leads, customers, waConversation, meetings, blocks] = await Promise.all([
    upsertCall(businessId, input, phone, now),
    phone ? resolveLeadForContact(businessId, phone, now) : Promise.resolve({ active: null, previous: null }),
    phone ? findCustomersByPhone(businessId, prisma, phone) : Promise.resolve([]),
    phone
      ? prisma.waBotConversation.findUnique({
          where: { businessId_phone: { businessId, phone: toWaId(phone) } },
          select: { summaryCallLogId: true },
        })
      : Promise.resolve(null),
    prisma.leadMeeting.findMany({
      where: {
        businessId,
        status: "scheduled",
        date: { gte: new Date(`${days[0]}T00:00:00Z`), lte: new Date(`${days[days.length - 1]}T00:00:00Z`) },
      },
      select: { date: true, startTime: true, endTime: true },
    }),
    prisma.availabilityBlock.findMany({
      where: {
        businessId,
        startAt: { lt: range.end },
        endAt: { gt: range.start },
        OR: SALES_BLOCK_WORDS.map((w) => ({ reason: { contains: w } })),
      },
      select: { startAt: true, endAt: true },
    }),
  ]);
  const t1 = performance.now();

  const lead = leads.active ?? leads.previous;
  const customer = customers[0] ?? null;
  const today = israelYmd(now);

  const [stage, nextMeetings, waLog] = await Promise.all([
    lead
      ? prisma.leadStage.findFirst({ where: { id: lead.stage, businessId }, select: { name: true } })
      : Promise.resolve(null),
    leads.active
      ? prisma.leadMeeting.findMany({
          where: { leadId: leads.active.id, status: "scheduled", date: { gte: new Date(`${today}T00:00:00Z`) } },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          select: { date: true, startTime: true, endTime: true },
          take: 5,
        })
      : Promise.resolve([]),
    waConversation?.summaryCallLogId
      ? prisma.callLog.findFirst({
          where: { id: waConversation.summaryCallLogId, lead: { businessId } },
          select: { summary: true },
        })
      : Promise.resolve(null),
    leads.active && !call.leadId
      ? prisma.voiceAgentCall.updateMany({ where: { id: call.id, leadId: null }, data: { leadId: leads.active.id } })
      : Promise.resolve(null),
  ]);
  const t2 = performance.now();

  const busy: Interval[] = [...meetings.map(meetingInterval), ...blocks.map((b) => ({ start: b.startAt, end: b.endAt }))];
  const upcoming = nextMeetings
    .map((m) => ({ ymd: m.date.toISOString().slice(0, 10), hhmm: m.startTime }))
    .find((m) => israelInstant(m.ymd, m.hhmm).getTime() > now.getTime());

  const leadName = lead && !isPlaceholderLeadName(lead.name) ? lead.name : null;
  const result: VoiceStartResult = {
    known: !!(lead || customer),
    isCustomer: !!customer,
    returning: !leads.active && !!leads.previous,
    name: leadName ?? customer?.name ?? null,
    dogName: parsePetNotesBlock(lead?.notes)?.name?.trim() || null,
    stage: stage?.name ?? null,
    upcomingMeeting: upcoming ? { ...upcoming, label: spokenSlotLabel(upcoming.ymd, upcoming.hhmm, now) } : null,
    whatsappSummary: whatsappSummaryText(waLog?.summary),
    slots: pickSalesSlots(now, busy, days),
  };
  const t3 = performance.now();
  return {
    result,
    timings: { round1Ms: Math.round(t1 - t0), round2Ms: Math.round(t2 - t1), totalMs: Math.round(t3 - t0) },
  };
}
