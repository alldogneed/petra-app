/**
 * Answered-call retry queue: schedule (+3 / +10 / +30 min / +2 h final), the row as a lock,
 * and how each attempt result moves the row.
 */
type Row = {
  id: string;
  businessId: string;
  callId: string;
  payload: unknown;
  attempts: number;
  nextAttemptAt: Date;
  lockedUntil: Date | null;
  status: string;
  lastError: string | null;
  createdAt: Date;
};
const mockRows: Row[] = [];

jest.mock("@/lib/prisma", () => {
  const matches = (r: Row, where: Record<string, unknown>, now: Date) => {
    if (where.id && r.id !== where.id) return false;
    if (where.status && r.status !== where.status) return false;
    const nxt = where.nextAttemptAt as { lte?: Date } | undefined;
    if (nxt?.lte && !(r.nextAttemptAt <= nxt.lte)) return false;
    if (where.OR) {
      const freeLock = !r.lockedUntil || r.lockedUntil < now;
      if (!freeLock) return false;
    }
    return true;
  };
  const apply = (r: Row, data: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && "increment" in (v as object)) (r as Record<string, unknown>)[k] = (r as never)[k] + (v as { increment: number }).increment;
      else if (v && typeof v === "object" && "decrement" in (v as object)) (r as Record<string, unknown>)[k] = (r as never)[k] - (v as { decrement: number }).decrement;
      else (r as Record<string, unknown>)[k] = v;
    }
  };
  const prisma = {
    paycallCallRetry: {
      upsert: jest.fn(async ({ where, create }: { where: { callId: string }; create: Partial<Row> }) => {
        let r = mockRows.find((x) => x.callId === where.callId);
        if (!r) {
          r = {
            id: `row-${mockRows.length + 1}`,
            attempts: 0,
            lockedUntil: null,
            status: "pending",
            lastError: null,
            createdAt: (create.nextAttemptAt as Date) ?? new Date(),
            ...create,
          } as Row;
          mockRows.push(r);
        }
        return { ...r };
      }),
      updateMany: jest.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const now = new Date();
        const hit = mockRows.filter((r) => matches(r, where, now));
        hit.forEach((r) => apply(r, data));
        return { count: hit.length };
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const r = mockRows.find((x) => x.id === where.id)!;
        apply(r, data);
        return r;
      }),
      findUnique: jest.fn(async ({ where }: { where: { callId: string } }) => mockRows.find((r) => r.callId === where.callId) ?? null),
      findMany: jest.fn(async () =>
        mockRows.filter((r) => r.status === "pending" && r.nextAttemptAt <= new Date()).map(({ id, callId, payload }) => ({ id, callId, payload }))
      ),
    },
  };
  return { __esModule: true, default: prisma, prisma };
});

const mockAttempts: Array<{ callId: string; finalAttempt: boolean }> = [];
let mockNextResult: { status: string; reason?: string } = { status: "retry_later", reason: "recording_unavailable" };
jest.mock("@/lib/alldog/call-summary", () => ({
  processAnsweredCall: jest.fn(async (input: { callId: string }, opts: { finalAttempt?: boolean }) => {
    mockAttempts.push({ callId: input.callId, finalAttempt: !!opts.finalAttempt });
    return opts.finalAttempt && mockNextResult.status === "retry_later" ? { status: "logged", summarized: false } : mockNextResult;
  }),
}));

import {
  fromPayload,
  isFinalAttempt,
  MAX_ATTEMPTS,
  nextAttemptAt,
  processDueRetries,
  runAnsweredCall,
  toPayload,
} from "@/lib/alldog/call-retry";

const OLD_ENV = process.env;
beforeEach(() => {
  mockRows.length = 0;
  mockAttempts.length = 0;
  mockNextResult = { status: "retry_later", reason: "recording_unavailable" };
  process.env = { ...OLD_ENV, ALLDOG_CALL_SUMMARIES_ENABLED: "true", ALLDOG_BUSINESS_ID: "biz", ANTHROPIC_API_KEY: "k", ELEVENLABS_API_KEY: "k" };
});
afterAll(() => {
  process.env = OLD_ENV;
});

const input = { callId: "158311139", phone: "0501234567", startedAt: new Date("2026-10-24T04:50:00Z"), billsec: 95, recordingUrl: null };

describe("schedule", () => {
  const t0 = new Date("2026-10-24T05:00:00Z");
  it("+3, +10, +30 min, +2 h after the first attempt, then nothing", () => {
    expect(nextAttemptAt(t0, 1)!.toISOString()).toBe("2026-10-24T05:03:00.000Z");
    expect(nextAttemptAt(t0, 2)!.toISOString()).toBe("2026-10-24T05:10:00.000Z");
    expect(nextAttemptAt(t0, 3)!.toISOString()).toBe("2026-10-24T05:30:00.000Z");
    expect(nextAttemptAt(t0, 4)!.toISOString()).toBe("2026-10-24T07:00:00.000Z");
    expect(nextAttemptAt(t0, 5)).toBeNull();
  });
  it("attempt 5 (the +2 h one) is the final attempt", () => {
    expect(MAX_ATTEMPTS).toBe(5);
    expect(isFinalAttempt(4)).toBe(false);
    expect(isFinalAttempt(5)).toBe(true);
  });
  it("payload round-trips (dates as ISO)", () => {
    expect(fromPayload(JSON.parse(JSON.stringify(toPayload(input))))).toEqual({ ...input, gclid: null, campaign: null, campaignParams: undefined });
    expect(fromPayload({ callId: "1" })).toBeNull();
  });
});

describe("runAnsweredCall", () => {
  it("first attempt not ready → row scheduled +3 min, lock released", async () => {
    const r = await runAnsweredCall(input);
    expect(r).toMatchObject({ status: "retry_later" });
    expect(mockRows).toHaveLength(1);
    const row = mockRows[0];
    expect(row.attempts).toBe(1);
    expect(row.lockedUntil).toBeNull();
    expect(row.status).toBe("pending");
    expect(row.nextAttemptAt.getTime() - row.createdAt.getTime()).toBe(3 * 60_000);
    expect(row.lastError).toBe("recording_unavailable");
  });

  it("not due yet → nothing runs", async () => {
    await runAnsweredCall(input);
    expect(await runAnsweredCall(input)).toEqual({ status: "not_due" });
    expect(mockAttempts).toHaveLength(1);
  });

  it("a row held by another run → in_progress (no double processing)", async () => {
    await runAnsweredCall(input);
    mockRows[0].nextAttemptAt = new Date(Date.now() - 1000);
    mockRows[0].lockedUntil = new Date(Date.now() + 60_000);
    expect(await runAnsweredCall(input)).toEqual({ status: "in_progress" });
    expect(mockAttempts).toHaveLength(1);
  });

  it("success → done; later sightings are duplicates", async () => {
    mockNextResult = { status: "logged" };
    await runAnsweredCall(input);
    expect(mockRows[0].status).toBe("done");
    expect(await runAnsweredCall(input)).toEqual({ status: "duplicate" });
  });

  it("the 5th attempt is final and closes the row", async () => {
    await runAnsweredCall(input); // attempt 1
    for (let i = 2; i <= 5; i++) {
      mockRows[0].nextAttemptAt = new Date(Date.now() - 1000); // time passes
      await runAnsweredCall(input);
    }
    expect(mockAttempts.map((a) => a.finalAttempt)).toEqual([false, false, false, false, true]);
    expect(mockRows[0].status).toBe("done");
  });

  it("forceFinal (daily sync, old call) → final on the first attempt", async () => {
    await runAnsweredCall(input, { forceFinal: true });
    expect(mockAttempts).toEqual([{ callId: input.callId, finalAttempt: true }]);
    expect(mockRows[0].status).toBe("done");
  });

  it("flag off → nothing is queued", async () => {
    process.env.ALLDOG_CALL_SUMMARIES_ENABLED = "false";
    expect(await runAnsweredCall(input)).toEqual({ status: "disabled" });
    expect(mockRows).toHaveLength(0);
  });
});

describe("processDueRetries", () => {
  it("runs only due rows", async () => {
    await runAnsweredCall(input); // queued for +3 min
    await runAnsweredCall({ ...input, callId: "2" });
    mockRows[1].nextAttemptAt = new Date(Date.now() - 1000); // only call 2 is due
    const r = await processDueRetries({ budgetMs: 10_000 });
    expect(r.due).toBe(1);
    expect(r.ran).toBe(1);
    expect(mockAttempts.map((a) => a.callId)).toEqual([input.callId, "2", "2"]);
  });
});
