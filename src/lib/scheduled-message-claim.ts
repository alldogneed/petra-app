/**
 * One send per scheduled message, even when two runs overlap.
 *
 * The reminder cron can be started by more than one scheduler (GitHub Actions,
 * Supabase pg_cron, Vercel) and the business can press "שלח עכשיו" at the same
 * moment. Before sending, a run "claims" the row with a conditional update:
 * it only wins when the row is still unsent, unchanged since it was read
 * (compare-and-swap on `updatedAt`) and not claimed by another run in the last
 * SEND_LEASE_MS (the claim itself bumps `updatedAt`). The status values do not
 * change — a run that dies mid-send leaves the row PENDING/FAILED and the next
 * run retries it after the lease.
 */
import type { PrismaClient } from "@prisma/client";

/** A claim blocks other runs for this long — longer than one template-chain send. */
export const SEND_LEASE_MS = 2 * 60 * 1000;

export const CLAIMABLE_STATUSES = ["PENDING", "FAILED"] as const;

export interface ClaimableMessage {
  id: string;
  status: string;
  updatedAt: Date;
  sendAt: Date;
}

/**
 * Prisma `where` for the claim (exported for tests).
 * `manual` ("שלח עכשיו"): only a PENDING message that is already due can be in
 * the cron's hands right now, so only that one waits for the lease — a FAILED one
 * or one scheduled for later is sent immediately (still compare-and-swap).
 */
export function claimWhere(msg: ClaimableMessage, now: Date, opts: { manual?: boolean } = {}) {
  const leaseEdge = new Date(now.getTime() - SEND_LEASE_MS);
  const cronMayHoldIt = msg.status === "PENDING" && msg.sendAt.getTime() <= now.getTime();
  const leaseFree = opts.manual && !cronMayHoldIt ? {} : { updatedAt: { lt: leaseEdge } };
  return {
    id: msg.id,
    status: { in: [...CLAIMABLE_STATUSES] },
    AND: [{ updatedAt: msg.updatedAt }, leaseFree],
  };
}

/** True when this run may send the message (and now holds the lease). */
export async function claimScheduledMessage(
  db: Pick<PrismaClient, "scheduledMessage">,
  msg: ClaimableMessage,
  opts: { manual?: boolean; now?: Date } = {}
): Promise<boolean> {
  const now = opts.now ?? new Date();
  const res = await db.scheduledMessage.updateMany({
    where: claimWhere(msg, now, opts),
    data: { updatedAt: now },
  });
  return res.count === 1;
}
