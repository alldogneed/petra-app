/**
 * AllDog voice agent — what blocks Racheli's sales slots, loaded in ONE parallel round:
 * scheduled LeadMeetings of the business + AvailabilityBlocks whose reason contains "חג" or "מכירות".
 * Appointments and Google Calendar are deliberately NOT used (Or, 12/11/2026; Limited Use).
 * Shared by /start (offered slots) and /book (alternatives).
 */
import prisma from "@/lib/prisma";
import { SALES_BLOCK_WORDS, meetingInterval, salesRange, type Interval } from "@/lib/alldog/voice-agent/slots";

export async function loadSalesBusy(businessId: string, days: string[]): Promise<Interval[]> {
  const range = salesRange(days);
  const [meetings, blocks] = await Promise.all([
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
  return [...meetings.map(meetingInterval), ...blocks.map((b) => ({ start: b.startAt, end: b.endAt }))];
}
