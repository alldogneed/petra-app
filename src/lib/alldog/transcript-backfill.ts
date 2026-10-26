/**
 * AllDog item 36 — one-time transcription of past PayCall recordings (29/7–24/10/2026) so Or /
 * Claude can analyse objections and sales patterns. Writes ONLY to AllDogCallTranscriptBackfill:
 * no lead, no CallLog, no task, no message, no item 31 alerts. Nothing is logged about the
 * content or the caller's phone.
 */
import prisma from "@/lib/prisma";
import { downloadRecord, getCalls, MIN_SUMMARY_BILLSEC, type PaycallCall } from "@/lib/paycall";
import { formatTranscript, transcribeAudio } from "@/lib/stt";

export const BACKFILL_FROM = "2026-07-29";
export const BACKFILL_TO = "2026-10-24";
/** Rows per call and the time budget of one request (route maxDuration = 300). */
export const BACKFILL_BATCH = 4;
export const BACKFILL_BUDGET_MS = 240_000;
/** A row taken by a run that died is free again after this long. */
const STALE_CLAIM_MS = 6 * 60 * 1000;

// ─── Pure helpers (tested) ──────────────────────────────────────────────────

/** PayCall START "YYYY-MM-DD HH:MM:SS" (Israel local) → "YYYY-MM-DD", or null. */
export function callYmd(start: string | null | undefined): string | null {
  const m = (start ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** A @db.Date value → "dd/mm/yyyy" for downloadRecord. */
export function callDayFor(callDate: Date): string {
  const d = String(callDate.getUTCDate()).padStart(2, "0");
  const m = String(callDate.getUTCMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${callDate.getUTCFullYear()}`;
}

/** Answered calls of the backfill window that are long enough to have a useful recording. */
export function isBackfillCandidate(c: Pick<PaycallCall, "ID" | "START" | "DISPOSITION" | "DURATION">): boolean {
  const ymd = callYmd(c.START);
  return (
    /^\d{1,20}$/.test(c.ID ?? "") &&
    c.DISPOSITION === "ANSWER" &&
    Number(c.DURATION) >= MIN_SUMMARY_BILLSEC &&
    !!ymd &&
    ymd >= BACKFILL_FROM &&
    ymd <= BACKFILL_TO
  );
}

/** Short error text for the row: no phone numbers, no long payloads. */
export function shortError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/\d{7,}/g, "###").replace(/\s+/g, " ").trim().slice(0, 200) || "error";
}

// ─── Seed (?seed=1) ─────────────────────────────────────────────────────────

/** Month windows (PayCall getCalls takes a date range). */
function windows(): Array<{ from: Date; to: Date }> {
  const out: Array<{ from: Date; to: Date }> = [];
  let from = new Date(`${BACKFILL_FROM}T00:00:00Z`);
  const end = new Date(`${BACKFILL_TO}T00:00:00Z`);
  while (from <= end) {
    const to = new Date(Math.min(from.getTime() + 13 * 86_400_000, end.getTime()));
    out.push({ from, to });
    from = new Date(to.getTime() + 86_400_000);
  }
  return out;
}

/** Inserts every candidate call as pending (existing rows are left as they are). */
export async function seedBackfill(): Promise<{ found: number; inserted: number; truncated: boolean }> {
  let truncated = false;
  const rows = new Map<string, { callId: string; callDate: Date; durationSec: number }>();
  for (const w of windows()) {
    const calls = await getCalls({ fromDate: w.from, toDate: w.to, limit: 2000 });
    if (calls.length >= 2000) truncated = true; // more calls than one page — tell the caller
    for (const c of calls) {
      if (!isBackfillCandidate(c)) continue;
      rows.set(c.ID, { callId: c.ID, callDate: new Date(`${callYmd(c.START)}T00:00:00Z`), durationSec: Number(c.DURATION) });
    }
  }
  const data = [...rows.values()];
  const res = data.length ? await prisma.allDogCallTranscriptBackfill.createMany({ data, skipDuplicates: true }) : { count: 0 };
  return { found: data.length, inserted: res.count, truncated };
}

// ─── Run ────────────────────────────────────────────────────────────────────

/** Takes one pending row (compare-and-swap on claimedAt — two runs never take the same row). */
async function claimNext(now: Date): Promise<{ callId: string; callDate: Date } | null> {
  const free = { OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(now.getTime() - STALE_CLAIM_MS) } }] };
  const candidates = await prisma.allDogCallTranscriptBackfill.findMany({
    where: { status: "pending", ...free },
    orderBy: [{ callDate: "asc" }, { callId: "asc" }],
    take: 5,
    select: { callId: true, callDate: true, claimedAt: true },
  });
  for (const c of candidates) {
    const ok = await prisma.allDogCallTranscriptBackfill.updateMany({
      where: { callId: c.callId, status: "pending", claimedAt: c.claimedAt },
      data: { claimedAt: now },
    });
    if (ok.count === 1) return { callId: c.callId, callDate: c.callDate };
  }
  return null;
}

/** Download + transcribe one call; the row ends done or error. Never throws. */
async function transcribeRow(row: { callId: string; callDate: Date }, msLeft: number): Promise<"done" | "error"> {
  try {
    const recording = await downloadRecord(row.callId, callDayFor(row.callDate));
    const timeoutMs = Math.max(30_000, Math.min(180_000, msLeft - 5_000));
    const t = await transcribeAudio({ data: recording.data, contentType: recording.contentType }, { language: "he", diarize: true, timeoutMs });
    const transcript = formatTranscript(t);
    if (!transcript.trim()) throw new Error("empty transcript");
    await prisma.allDogCallTranscriptBackfill.update({
      where: { callId: row.callId },
      data: { status: "done", transcript, error: null, claimedAt: null },
    });
    return "done";
  } catch (err) {
    await prisma.allDogCallTranscriptBackfill
      .update({ where: { callId: row.callId }, data: { status: "error", error: shortError(err), claimedAt: null } })
      .catch(() => undefined);
    return "error";
  }
}

/**
 * One cron run: up to BACKFILL_BATCH pending rows, within the time budget. A new row starts only
 * with at least 2 minutes left (a download + Scribe call can take that long).
 */
export async function runBackfillBatch(opts: { budgetMs?: number; batch?: number } = {}): Promise<{ done: number; error: number; left: number }> {
  const started = Date.now();
  const budget = opts.budgetMs ?? BACKFILL_BUDGET_MS;
  let done = 0;
  let error = 0;
  for (let i = 0; i < (opts.batch ?? BACKFILL_BATCH); i++) {
    const msLeft = budget + 45_000 - (Date.now() - started); // route maxDuration 300 s
    if (Date.now() - started > budget || msLeft < 120_000) break;
    const row = await claimNext(new Date());
    if (!row) break;
    if ((await transcribeRow(row, msLeft)) === "done") done++;
    else error++;
  }
  const left = await prisma.allDogCallTranscriptBackfill.count({ where: { status: "pending" } });
  return { done, error, left };
}
