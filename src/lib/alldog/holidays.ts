/** AllDog holiday blocks for the automatic messages' quiet time (item 40.3). */
import prisma from "@/lib/prisma";
import type { QuietBlock } from "@/lib/alldog/missed-call-rules";

/** The business's holiday blocks (AvailabilityBlock, reason with "חג") that matter for the next week. Never throws. */
export async function holidayBlocks(businessId: string, now: Date): Promise<QuietBlock[]> {
  try {
    return await prisma.availabilityBlock.findMany({
      where: { businessId, endAt: { gt: now }, startAt: { lt: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000) }, reason: { contains: "חג" } },
      select: { startAt: true, endAt: true, reason: true },
      take: 20,
    });
  } catch {
    return []; // no holiday info → only Shabbat + 21:30–08:00 apply
  }
}
