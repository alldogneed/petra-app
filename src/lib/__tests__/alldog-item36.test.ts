/**
 * Item 36 — one-time transcription of past PayCall recordings into AllDogCallTranscriptBackfill.
 * In-memory table; PayCall + Scribe mocked. Nothing else is written (no lead / CallLog / task).
 */
type Row = { callId: string; callDate: Date; status: string; transcript: string | null; durationSec: number | null; error: string | null; claimedAt: Date | null };
const mockRows = new Map<string, Row>();
const mockOtherWrites: string[] = [];

jest.mock("@/lib/prisma", () => {
  const match = (r: Row, w: Record<string, unknown>) => {
    if (w.callId && r.callId !== w.callId) return false;
    if (w.status && r.status !== w.status) return false;
    if ("claimedAt" in w && (r.claimedAt?.getTime() ?? null) !== ((w.claimedAt as Date | null)?.getTime() ?? null)) return false;
    if (w.OR) {
      const or = w.OR as Array<{ claimedAt: null | { lt: Date } }>;
      const ok = or.some((c) => (c.claimedAt === null ? r.claimedAt === null : !!r.claimedAt && r.claimedAt < c.claimedAt.lt));
      if (!ok) return false;
    }
    return true;
  };
  const table = {
    findMany: async ({ where, take }: { where: Record<string, unknown>; take: number }) =>
      [...mockRows.values()].filter((r) => match(r, where)).sort((a, b) => +a.callDate - +b.callDate).slice(0, take).map((r) => ({ ...r })),
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
      let count = 0;
      for (const r of mockRows.values()) if (match(r, where)) { Object.assign(r, data); count++; }
      return { count };
    },
    update: async ({ where, data }: { where: { callId: string }; data: Partial<Row> }) => Object.assign(mockRows.get(where.callId)!, data),
    count: async ({ where }: { where: Record<string, unknown> }) => [...mockRows.values()].filter((r) => match(r, where)).length,
    createMany: async ({ data }: { data: Array<Pick<Row, "callId" | "callDate" | "durationSec">> }) => {
      let count = 0;
      for (const d of data) if (!mockRows.has(d.callId)) { mockRows.set(d.callId, { status: "pending", transcript: null, error: null, claimedAt: null, ...d }); count++; }
      return { count };
    },
  };
  const forbidden = new Proxy({}, { get: (_t, op) => () => { mockOtherWrites.push(String(op)); throw new Error("not allowed"); } });
  return { __esModule: true, default: { allDogCallTranscriptBackfill: table, lead: forbidden, callLog: forbidden, task: forbidden } };
});

const mockDownload = jest.fn();
const mockCalls = jest.fn();
jest.mock("@/lib/paycall", () => ({
  MIN_SUMMARY_BILLSEC: 20,
  downloadRecord: (...a: unknown[]) => mockDownload(...a),
  getCalls: (...a: unknown[]) => mockCalls(...a),
}));
const mockStt = jest.fn();
jest.mock("@/lib/stt", () => ({
  transcribeAudio: (...a: unknown[]) => mockStt(...a),
  formatTranscript: (t: { utterances: Array<{ speaker: string; text: string }> }) => t.utterances.map((u) => `דובר ${u.speaker}: ${u.text}`).join("\n"),
}));

import { callDayFor, callYmd, isBackfillCandidate, runBackfillBatch, seedBackfill, shortError } from "@/lib/alldog/transcript-backfill";

const row = (callId: string, ymd: string): Row => ({ callId, callDate: new Date(`${ymd}T00:00:00Z`), status: "pending", transcript: null, durationSec: 120, error: null, claimedAt: null });

beforeEach(() => {
  mockRows.clear();
  mockOtherWrites.length = 0;
  mockDownload.mockReset().mockResolvedValue({ data: new ArrayBuffer(8), contentType: "audio/mpeg" });
  mockStt.mockReset().mockResolvedValue({ text: "x", utterances: [{ speaker: "1", text: "שלום" }, { speaker: "2", text: "היי" }], languageCode: "he" });
  mockCalls.mockReset();
});

describe("pure helpers", () => {
  it("dates", () => {
    expect(callYmd("2026-08-03 14:22:01")).toBe("2026-08-03");
    expect(callYmd("")).toBeNull();
    expect(callDayFor(new Date("2026-08-03T00:00:00Z"))).toBe("03/08/2026");
  });
  it("only answered calls of 29/7–24/10, ≥ 20 s", () => {
    const c = { ID: "123", START: "2026-08-03 10:00:00", DISPOSITION: "ANSWER", DURATION: "95" };
    expect(isBackfillCandidate(c)).toBe(true);
    expect(isBackfillCandidate({ ...c, DISPOSITION: "NOANSWER" })).toBe(false);
    expect(isBackfillCandidate({ ...c, DURATION: "10" })).toBe(false);
    expect(isBackfillCandidate({ ...c, START: "2026-07-28 23:59:00" })).toBe(false);
    expect(isBackfillCandidate({ ...c, START: "2026-10-25 08:00:00" })).toBe(false);
    expect(isBackfillCandidate({ ...c, START: "2026-10-24 21:00:00" })).toBe(true);
  });
  it("errors carry no phone numbers", () => {
    expect(shortError(new Error("downloadRecord: no record for 0541234567"))).toBe("downloadRecord: no record for ###");
  });
});

describe("runBackfillBatch", () => {
  it("transcribes up to 4 pending rows and returns counts only", async () => {
    for (let i = 1; i <= 6; i++) mockRows.set(String(i), row(String(i), `2026-08-0${i}`));
    const res = await runBackfillBatch();
    expect(res).toEqual({ done: 4, error: 0, left: 2 });
    expect(mockRows.get("1")).toMatchObject({ status: "done", transcript: "דובר 1: שלום\nדובר 2: היי", claimedAt: null });
    expect(mockDownload).toHaveBeenCalledWith("1", "01/08/2026");
    expect(mockStt.mock.calls[0][1]).toMatchObject({ language: "he", diarize: true });
    expect(mockOtherWrites).toEqual([]);
  });
  it("a failure → status error + short message, the batch goes on", async () => {
    mockRows.set("1", row("1", "2026-08-01"));
    mockRows.set("2", row("2", "2026-08-02"));
    mockDownload.mockRejectedValueOnce(new Error("downloadRecord: Service Denied"));
    const res = await runBackfillBatch();
    expect(res).toEqual({ done: 1, error: 1, left: 0 });
    expect(mockRows.get("1")).toMatchObject({ status: "error", error: "downloadRecord: Service Denied" });
  });
  it("a row claimed by another run is skipped; a stale claim is taken again", async () => {
    mockRows.set("1", { ...row("1", "2026-08-01"), claimedAt: new Date() });
    mockRows.set("2", { ...row("2", "2026-08-02"), claimedAt: new Date(Date.now() - 10 * 60 * 1000) });
    const res = await runBackfillBatch();
    expect(res).toEqual({ done: 1, error: 0, left: 1 });
    expect(mockRows.get("1")!.status).toBe("pending");
    expect(mockRows.get("2")!.status).toBe("done");
  });
  it("stops when the time budget is used up", async () => {
    mockRows.set("1", row("1", "2026-08-01"));
    expect(await runBackfillBatch({ budgetMs: 0 })).toEqual({ done: 0, error: 0, left: 1 });
  });
});

describe("seedBackfill", () => {
  it("inserts the answered calls of the window once", async () => {
    mockCalls.mockResolvedValue([
      { ID: "10", START: "2026-08-03 10:00:00", DISPOSITION: "ANSWER", DURATION: "95" },
      { ID: "11", START: "2026-08-03 11:00:00", DISPOSITION: "NOANSWER", DURATION: "0" },
    ]);
    const first = await seedBackfill();
    expect(first).toEqual({ found: 1, inserted: 1, truncated: false });
    expect(mockRows.get("10")).toMatchObject({ status: "pending", durationSec: 95 });
    expect((await seedBackfill()).inserted).toBe(0);
  });
});
