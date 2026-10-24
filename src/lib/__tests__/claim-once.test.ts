/**
 * claimOnce / rateLimitAsync without Redis: Postgres (RateLimitBucket) first, per-instance
 * memory only when the DB fails or is slow. (The atomic SQL itself was checked against a
 * real Postgres 16: 20 parallel first claims → exactly 1 wins; an expired claim is taken over.)
 */
let mockQueryRaw: jest.Mock;
jest.mock("@/lib/prisma", () => {
  mockQueryRaw = jest.fn();
  const prisma = {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    rateLimitBucket: { deleteMany: jest.fn(async () => ({ count: 0 })) },
  };
  return { __esModule: true, default: prisma, prisma };
});

import { claimOnce, rateLimitAsync } from "@/lib/rate-limit";

const sqlOf = (call: unknown[]) => (call[0] as TemplateStringsArray).join("?");

beforeEach(() => {
  mockQueryRaw.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

describe("claimOnce (Postgres)", () => {
  it("first caller wins (a row comes back), later callers lose (no row)", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ key: "claim:a" }]).mockResolvedValueOnce([]);
    expect(await claimOnce("a", 60)).toBe(true);
    expect(await claimOnce("a", 60)).toBe(false);
  });

  it("insert-or-take-over-an-expired-row, keyed claim:<key>, expiry = now + ttl", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ key: "claim:b" }]);
    const before = Date.now();
    await claimOnce("b", 3600);
    const call = mockQueryRaw.mock.calls[0];
    const sql = sqlOf(call);
    expect(sql).toContain('INSERT INTO "RateLimitBucket"');
    expect(sql).toContain("ON CONFLICT");
    expect(sql).toContain('WHERE "RateLimitBucket"."windowEnd" < NOW()');
    expect(call[1]).toBe("claim:b");
    const until = (call[2] as Date).getTime();
    expect(until - before).toBeGreaterThanOrEqual(3600_000 - 50);
    expect(until - before).toBeLessThanOrEqual(3600_000 + 1000);
  });

  it("DB error → per-instance memory (first true, then false)", async () => {
    mockQueryRaw.mockRejectedValue(new Error("db down"));
    expect(await claimOnce("c", 60)).toBe(true);
    expect(await claimOnce("c", 60)).toBe(false);
  });

  it("DB too slow → memory, never blocks the request", async () => {
    jest.useFakeTimers();
    mockQueryRaw.mockImplementation(() => new Promise(() => {}));
    const p = claimOnce("d", 60);
    await jest.advanceTimersByTimeAsync(1600);
    expect(await p).toBe(true);
    jest.useRealTimers();
  });
});

describe("rateLimitAsync (Postgres, no Redis)", () => {
  it("uses the DB count", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ count: 1 }]).mockResolvedValueOnce([{ count: 3 }]);
    expect((await rateLimitAsync("t", "ip", { max: 2, windowMs: 60_000 })).allowed).toBe(true);
    expect((await rateLimitAsync("t", "ip", { max: 2, windowMs: 60_000 })).allowed).toBe(false);
  });

  it("DB error → memory limiter", async () => {
    mockQueryRaw.mockRejectedValue(new Error("db down"));
    const opts = { max: 2, windowMs: 60_000 };
    const r = [];
    for (let i = 0; i < 3; i++) r.push((await rateLimitAsync("mem", "ip9", opts)).allowed);
    expect(r).toEqual([true, true, false]);
  });
});
