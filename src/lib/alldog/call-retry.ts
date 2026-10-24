/**
 * Answered PayCall calls — retry queue (table PaycallCallRetry, prisma/paycall_call_retry.sql).
 *
 * PayCall's recording is usually not ready in the first seconds after the call ends
 * (dlink "no such file", downloadRecord "empty body"). Every answered call gets ONE row:
 *   attempt 1  → right away (the webhook)
 *   attempt 2  → +3 min      attempt 3 → +10 min      attempt 4 → +30 min
 *   attempt 5  → +2 h — the final attempt: writes the line even without a summary
 * Retries run from /api/cron/alldog-call-retry (Supabase pg_cron every 5 min +
 * the GitHub workflow as a fallback).
 *
 * The row is also the processing lock: a conditional update claims it for 5 minutes, so the
 * webhook, the retry cron and the daily paycall-sync never work on the same call at once
 * (no Redis — claimOnce falls back to per-instance memory when Redis is down).
 */
import prisma from "@/lib/prisma";
import { allDogBusinessId, isCallSummariesEnabled } from "@/lib/alldog/config";
import { processAnsweredCall, type AnsweredCallInput, type AnsweredCallResult } from "@/lib/alldog/call-summary";

/** Minutes after the first attempt for attempts 2, 3, 4 and 5 (the last one is final). */
export const RETRY_DELAYS_MIN = [3, 10, 30, 120] as const;
export const MAX_ATTEMPTS = RETRY_DELAYS_MIN.length + 1;
const LOCK_MS = 5 * 60 * 1000;

/** After attempt `attemptsDone` (1-based) → when the next one is due, or null when that was the last. */
export function nextAttemptAt(firstAttemptAt: Date, attemptsDone: number): Date | null {
  if (attemptsDone < 1 || attemptsDone >= MAX_ATTEMPTS) return null;
  return new Date(firstAttemptAt.getTime() + RETRY_DELAYS_MIN[attemptsDone - 1] * 60_000);
}

export function isFinalAttempt(attemptNumber: number): boolean {
  return attemptNumber >= MAX_ATTEMPTS;
}

interface StoredPayload extends Omit<AnsweredCallInput, "startedAt"> {
  startedAt: string;
}

export function toPayload(input: AnsweredCallInput): StoredPayload {
  return { ...input, startedAt: input.startedAt.toISOString() };
}

export function fromPayload(raw: unknown): AnsweredCallInput | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<StoredPayload>;
  if (typeof p.callId !== "string" || typeof p.phone !== "string" || typeof p.startedAt !== "string") return null;
  const startedAt = new Date(p.startedAt);
  if (isNaN(startedAt.getTime())) return null;
  return {
    callId: p.callId,
    phone: p.phone,
    startedAt,
    billsec: typeof p.billsec === "number" ? p.billsec : null,
    recordingUrl: p.recordingUrl ?? null,
    gclid: p.gclid ?? null,
    campaign: p.campaign ?? null,
    campaignParams: p.campaignParams ?? undefined,
  };
}

export type RunResult =
  | AnsweredCallResult
  | { status: "not_due" }
  | { status: "error"; message: string };

/**
 * Run one attempt for this call through its queue row (created on first sight).
 * `forceFinal` (daily sync for an old call): this attempt must write the line.
 */
export async function runAnsweredCall(
  input: AnsweredCallInput,
  opts: { forceFinal?: boolean } = {}
): Promise<RunResult> {
  const businessId = allDogBusinessId();
  if (!isCallSummariesEnabled() || !businessId) return { status: "disabled" };

  const now = new Date();
  const row = await prisma.paycallCallRetry.upsert({
    where: { callId: input.callId },
    create: { businessId, callId: input.callId, payload: toPayload(input) as object, nextAttemptAt: now },
    update: {},
  });
  if (row.status !== "pending") return { status: "duplicate" };

  // Claim: due, and not held by another run (an expired lock = a run that died).
  const claimed = await prisma.paycallCallRetry.updateMany({
    where: {
      id: row.id,
      status: "pending",
      nextAttemptAt: { lte: now },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
    },
    data: { lockedUntil: new Date(now.getTime() + LOCK_MS), attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return row.nextAttemptAt > now ? { status: "not_due" } : { status: "in_progress" };

  const attemptNumber = row.attempts + 1;
  const finalAttempt = !!opts.forceFinal || isFinalAttempt(attemptNumber);
  const next = finalAttempt ? null : nextAttemptAt(row.createdAt, attemptNumber);

  try {
    const result = await processAnsweredCall(input, { finalAttempt });
    if (result.status === "retry_later" && next) {
      await prisma.paycallCallRetry.update({
        where: { id: row.id },
        data: { nextAttemptAt: next, lockedUntil: null, lastError: result.reason },
      });
    } else if (result.status === "disabled") {
      // Flag switched off mid-way: give the attempt back, keep the schedule.
      await prisma.paycallCallRetry.update({ where: { id: row.id }, data: { lockedUntil: null, attempts: { decrement: 1 } } });
    } else {
      await prisma.paycallCallRetry.update({
        where: { id: row.id },
        data: {
          status: result.status === "retry_later" ? "failed" : "done",
          lockedUntil: null,
          lastError: result.status === "retry_later" ? result.reason : null,
        },
      });
    }
    return result;
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    await prisma.paycallCallRetry
      .update({
        where: { id: row.id },
        data: next ? { nextAttemptAt: next, lockedUntil: null, lastError: message } : { status: "failed", lockedUntil: null, lastError: message },
      })
      .catch(() => {});
    console.error(`[alldog-calls] attempt ${attemptNumber} for call ${input.callId} failed:`, message);
    return { status: "error", message };
  }
}

/** Is this call already in the queue (any status)? Used by the daily sync to leave it to the queue. */
export async function isQueued(callId: string): Promise<boolean> {
  return !!(await prisma.paycallCallRetry.findUnique({ where: { callId }, select: { id: true } }));
}

/** Cron: run every due attempt, oldest first, within a time budget. */
export async function processDueRetries(opts: { budgetMs: number; limit?: number }): Promise<{
  due: number;
  ran: number;
  results: Record<string, number>;
}> {
  const started = Date.now();
  const due = await prisma.paycallCallRetry.findMany({
    where: { status: "pending", nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: opts.limit ?? 20,
    select: { id: true, callId: true, payload: true },
  });
  const results: Record<string, number> = {};
  let ran = 0;
  for (const row of due) {
    if (Date.now() - started > opts.budgetMs) break;
    const input = fromPayload(row.payload);
    if (!input) {
      await prisma.paycallCallRetry.update({ where: { id: row.id }, data: { status: "failed", lastError: "bad payload" } });
      results.bad_payload = (results.bad_payload ?? 0) + 1;
      continue;
    }
    const r = await runAnsweredCall(input);
    ran++;
    results[r.status] = (results[r.status] ?? 0) + 1;
  }
  return { due: due.length, ran, results };
}
