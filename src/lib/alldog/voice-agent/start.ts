/**
 * AllDog voice agent — the call-start lookup (POST /api/webhooks/alldog-voice/start).
 *
 * Records the call (VoiceAgentCall, idempotent on the ElevenLabs conversation id) and recognizes the
 * caller with the same matchers as the bot and PayCall (resolveLeadForContact + findCustomersByPhone).
 * Never creates a lead. The answer is the minimum the conversation needs (Or, 21/11/2026): first
 * name, the dog's name, the city, whether this is an existing customer and whether a call is already
 * booked — no stage, no WhatsApp summary, no history, payments or address. No slots either: Eliran
 * does not book; the rep calls back herself.
 * The caller waits on the line for this answer, so only the lookups run before it:
 *   round 1 (parallel): lead lookup · customer lookup
 *   round 2 (only when an active lead is known): the lead's next meeting
 * Recording the call (the VoiceAgentCall row + its link to the lead) is NOT needed to recognize the
 * caller — `record()` does it after the response (/details and the end-of-call webhook create the
 * row anyway when it is missing).
 * The same lookup serves the ElevenLabs conversation-initiation webhook (/init, init.ts).
 */
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { findCustomersByPhone } from "@/services/clients";
import { isPlaceholderLeadName, localPhone, resolveLeadForContact } from "@/lib/alldog/leads";
import { parsePetNotesBlock } from "@/lib/lead-pet-notes";
import { israelInstant, israelYmd } from "@/lib/alldog/time";
import { spokenSlotLabel } from "@/lib/alldog/voice-agent/slots";
import { firstNameOf } from "@/lib/alldog/voice-agent/booking-rules";

export interface VoiceStartInput {
  conversationId: string;
  callerPhone?: string | null;
  externalCallId?: string | null;
}

export interface VoiceStartResult {
  known: boolean;
  isCustomer: boolean;
  firstName: string | null;
  dogName: string | null;
  city: string | null;
  upcomingMeeting: { ymd: string; hhmm: string; label: string } | null;
}

export interface VoiceStartTimings { round1Ms: number; round2Ms: number; totalMs: number }

const HIDDEN_RE = /anonymous|restricted|private|unknown|חסוי|חסום/i;

/** The caller's number as Petra matches it ("0XXXXXXXXX"), or null for a missing / hidden / unusable id. */
export function callerPhoneNormOf(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t || HIDDEN_RE.test(t)) return null;
  const norm = localPhone(t);
  return norm.length >= 9 && norm.length <= 10 ? norm : null;
}

const CALL_SELECT = { id: true, leadId: true, leadMeetingId: true } as const;

/** Create the call row once; a repeated start returns the existing row (unique providerConversationId). */
export async function upsertCall(businessId: string, input: VoiceStartInput, callerPhoneNorm: string | null, now: Date) {
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
      select: CALL_SELECT,
    });
  } catch (e) {
    // Two starts racing on the same conversation id: the loser reads the winner's row.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return prisma.voiceAgentCall.findUniqueOrThrow({ where, select: CALL_SELECT });
    }
    throw e;
  }
}

/** Lookups only — nothing is written. `activeLeadId` is for the call row written afterwards. */
export async function identifyCaller(
  businessId: string,
  rawCallerPhone: string | null | undefined,
  now: Date = new Date()
): Promise<{ result: VoiceStartResult; activeLeadId: string | null; timings: VoiceStartTimings }> {
  const t0 = performance.now();
  const phone = callerPhoneNormOf(rawCallerPhone);

  const [leads, customers] = await Promise.all([
    phone ? resolveLeadForContact(businessId, phone, now) : Promise.resolve({ active: null, previous: null }),
    phone ? findCustomersByPhone(businessId, prisma, phone) : Promise.resolve([]),
  ]);
  const t1 = performance.now();

  const lead = leads.active ?? leads.previous;
  const customer = customers[0] ?? null;
  const nextMeetings = leads.active
    ? await prisma.leadMeeting.findMany({
        where: { leadId: leads.active.id, status: "scheduled", date: { gte: new Date(`${israelYmd(now)}T00:00:00Z`) } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        select: { date: true, startTime: true },
        take: 5,
      })
    : [];
  const t2 = performance.now();

  const upcoming = nextMeetings
    .map((m) => ({ ymd: m.date.toISOString().slice(0, 10), hhmm: m.startTime }))
    .find((m) => israelInstant(m.ymd, m.hhmm).getTime() > now.getTime());

  const leadName = lead && !isPlaceholderLeadName(lead.name) ? lead.name : null;
  const result: VoiceStartResult = {
    known: !!(lead || customer),
    isCustomer: !!customer,
    firstName: firstNameOf(leadName ?? customer?.name),
    dogName: parsePetNotesBlock(lead?.notes)?.name?.trim() || null,
    city: lead?.city?.trim() || null,
    upcomingMeeting: upcoming ? { ...upcoming, label: spokenSlotLabel(upcoming.ymd, upcoming.hhmm, now) } : null,
  };
  return {
    result,
    activeLeadId: leads.active?.id ?? null,
    timings: { round1Ms: Math.round(t1 - t0), round2Ms: Math.round(t2 - t1), totalMs: Math.round(performance.now() - t0) },
  };
}

/** The call row + its link to the active lead. Runs after the response; idempotent. */
export async function recordCallStart(businessId: string, input: VoiceStartInput, activeLeadId: string | null, now: Date = new Date()): Promise<void> {
  const call = await upsertCall(businessId, input, callerPhoneNormOf(input.callerPhone), now);
  if (activeLeadId && !call.leadId) {
    await prisma.voiceAgentCall.updateMany({ where: { id: call.id, leadId: null }, data: { leadId: activeLeadId } });
  }
}

export async function startVoiceCall(
  businessId: string,
  input: VoiceStartInput,
  now: Date = new Date()
): Promise<{ result: VoiceStartResult; timings: VoiceStartTimings; record: () => Promise<void> }> {
  const { result, activeLeadId, timings } = await identifyCaller(businessId, input.callerPhone, now);
  return { result, timings, record: () => recordCallStart(businessId, input, activeLeadId, now) };
}
