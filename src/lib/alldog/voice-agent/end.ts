/**
 * AllDog voice agent — storing the end-of-call webhook (POST /api/webhooks/alldog-voice/end).
 * Fast and idempotent per ElevenLabs conversation id (a retried webhook updates the same row):
 * status "ended", times, duration, the transcript (≤ 50,000 chars + ElevenLabs' own summary as a
 * fallback), the caller id if /start never ran — and the summary scheduled 2 minutes after the end
 * (summary-job.ts, so a /book still running at hang-up finishes first). Nothing else runs here.
 */
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { callerPhoneNormOf } from "@/lib/alldog/voice-agent/start";
import {
  SUMMARY_FIRST_DELAY_MS,
  SUMMARY_MAX_ATTEMPTS,
  capTranscript,
  type ParsedPostCall,
  type StoredTranscript,
} from "@/lib/alldog/voice-agent/end-rules";

export async function recordCallEnd(businessId: string, c: ParsedPostCall, now: Date = new Date()): Promise<{ id: string; created: boolean }> {
  const capped = capTranscript(c.turns);
  const transcript: StoredTranscript = {
    turns: capped.turns,
    omittedTurns: capped.omittedTurns,
    providerSummary: c.providerSummary,
    terminationReason: c.terminationReason,
  };
  const endedAt = c.startedAt && c.durationSeconds !== null ? new Date(c.startedAt.getTime() + c.durationSeconds * 1000) : now;
  const summaryNextAt = new Date(Math.max(now.getTime(), endedAt.getTime()) + SUMMARY_FIRST_DELAY_MS);
  const phoneNorm = callerPhoneNormOf(c.callerPhone);

  const existing = await prisma.voiceAgentCall.findUnique({
    where: { providerConversationId: c.conversationId },
    select: { id: true, startedAt: true, callerPhone: true, externalCallId: true, summaryCallLogId: true, summaryAttempts: true, summaryNextAt: true },
  });

  if (!existing) {
    try {
      const row = await prisma.voiceAgentCall.create({
        data: {
          businessId,
          providerConversationId: c.conversationId,
          callerPhone: c.callerPhone,
          callerPhoneNorm: phoneNorm,
          externalCallId: c.externalCallId,
          status: "ended",
          startedAt: c.startedAt,
          endedAt,
          durationSeconds: c.durationSeconds,
          transcript: transcript as unknown as Prisma.InputJsonValue,
          summaryNextAt,
        },
        select: { id: true },
      });
      return { id: row.id, created: true };
    } catch (e) {
      // /start created it at the same moment → fall through to the update.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      return recordCallEnd(businessId, c, now);
    }
  }

  // Schedule the summary only once (a retried webhook must not push a pending one back or redo a done one).
  const schedule = !existing.summaryCallLogId && !existing.summaryNextAt && existing.summaryAttempts < SUMMARY_MAX_ATTEMPTS;
  await prisma.voiceAgentCall.update({
    where: { id: existing.id },
    data: {
      status: "ended",
      endedAt,
      durationSeconds: c.durationSeconds,
      transcript: transcript as unknown as Prisma.InputJsonValue,
      ...(existing.startedAt ? {} : { startedAt: c.startedAt }),
      ...(existing.callerPhone ? {} : { callerPhone: c.callerPhone, callerPhoneNorm: phoneNorm }),
      ...(existing.externalCallId ? {} : { externalCallId: c.externalCallId }),
      ...(schedule ? { summaryNextAt } : {}),
    },
  });
  return { id: existing.id, created: false };
}
