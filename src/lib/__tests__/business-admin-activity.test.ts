/**
 * Tests for business-admin activity helpers — Israel day boundaries (incl. DST),
 * keyset cursor encode/decode, query parsing and xlsx cell sanitization.
 */

import {
  israelMidnightUtc,
  israelDayRange,
  israelOverviewBoundaries,
  israelYmd,
  formatIsraelDateTime,
  encodeCursor,
  decodeCursor,
  keysetAfter,
  paginate,
  parseActivityQuery,
  parseAiActivityQuery,
  sanitizeXlsxCell,
  cleanText,
  clampTake,
} from "@/lib/business-admin-activity";

const params = (o: Record<string, string>) => new URLSearchParams(o);

describe("israelMidnightUtc", () => {
  it("winter (UTC+2)", () => {
    expect(israelMidnightUtc("2026-01-15").toISOString()).toBe("2026-01-14T22:00:00.000Z");
  });
  it("summer (UTC+3)", () => {
    expect(israelMidnightUtc("2026-07-15").toISOString()).toBe("2026-07-14T21:00:00.000Z");
  });
  it("DST start day (2026-03-27, switch at 02:00) — midnight is still +2", () => {
    expect(israelMidnightUtc("2026-03-27").toISOString()).toBe("2026-03-26T22:00:00.000Z");
    expect(israelMidnightUtc("2026-03-28").toISOString()).toBe("2026-03-27T21:00:00.000Z");
  });
  it("DST end day (2026-10-25) — midnight is still +3, next day +2", () => {
    expect(israelMidnightUtc("2026-10-25").toISOString()).toBe("2026-10-24T21:00:00.000Z");
    expect(israelMidnightUtc("2026-10-26").toISOString()).toBe("2026-10-25T22:00:00.000Z");
  });
});

describe("israelDayRange", () => {
  it("is inclusive of the `to` day and spans a DST switch (23h day)", () => {
    const r = israelDayRange("2026-03-27", "2026-03-27");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.gte!.toISOString()).toBe("2026-03-26T22:00:00.000Z");
    expect(r.lt!.toISOString()).toBe("2026-03-27T21:00:00.000Z");
    expect(r.lt!.getTime() - r.gte!.getTime()).toBe(23 * 3600_000);
  });
  it("open-ended sides", () => {
    const r = israelDayRange("2026-05-01", null);
    expect(r.ok && r.gte && !r.lt).toBe(true);
    const r2 = israelDayRange(null, null);
    expect(r2).toEqual({ ok: true, gte: undefined, lt: undefined });
  });
  it("rejects invalid dates, reversed range, > 366 days", () => {
    expect(israelDayRange("2026-02-30", null).ok).toBe(false);
    expect(israelDayRange("2026/01/01", null).ok).toBe(false);
    expect(israelDayRange("2026-05-02", "2026-05-01").ok).toBe(false);
    expect(israelDayRange("2025-01-01", "2026-01-01").ok).toBe(true); // 366 days inclusive
    expect(israelDayRange("2025-01-01", "2026-01-02").ok).toBe(false);
  });
});

describe("israelOverviewBoundaries / israelYmd", () => {
  it("late UTC evening is already tomorrow in Israel", () => {
    const now = new Date("2026-09-30T22:30:00.000Z"); // 01:30 Oct 1 Israel
    expect(israelYmd(now)).toBe("2026-10-01");
    const b = israelOverviewBoundaries(now);
    expect(b.apptDayStart.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(b.apptDayEnd.toISOString()).toBe("2026-10-02T00:00:00.000Z");
    expect(b.monthStart.toISOString()).toBe("2026-09-30T21:00:00.000Z");
  });
  it("month start in winter is +2", () => {
    const b = israelOverviewBoundaries(new Date("2026-12-10T10:00:00Z"));
    expect(b.monthStart.toISOString()).toBe("2026-11-30T22:00:00.000Z");
  });
  it("formats Israel date-time", () => {
    expect(formatIsraelDateTime("2026-07-14T21:05:00.000Z")).toBe("15/07/2026 00:05");
  });
});

describe("cursor", () => {
  const row = { createdAt: new Date("2026-10-01T08:00:00.123Z"), id: "3f1c2a9e-1111-4bbb-8ccc-0123456789ab" };
  it("round-trips", () => {
    const c = decodeCursor(encodeCursor(row));
    expect(c).toEqual(row);
  });
  it("rejects malformed cursors", () => {
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("not a cursor!")).toBeNull();
    expect(decodeCursor(Buffer.from("garbage").toString("base64url"))).toBeNull();
    expect(decodeCursor(Buffer.from("2026-13-01T00:00:00.000Z|abc").toString("base64url"))).toBeNull();
    expect(decodeCursor(Buffer.from("2026-10-01T00:00:00.000Z|a b'; drop").toString("base64url"))).toBeNull();
    expect(decodeCursor(Buffer.from("2026-10-01T00:00:00.000Z|").toString("base64url"))).toBeNull();
    expect(decodeCursor("A".repeat(500))).toBeNull();
  });
  it("keysetAfter builds (createdAt, id) desc predicate", () => {
    expect(keysetAfter(row)).toEqual({
      OR: [{ createdAt: { lt: row.createdAt } }, { createdAt: row.createdAt, id: { lt: row.id } }],
    });
  });
  it("paginate returns nextCursor only when there is an extra row", () => {
    const rows = [1, 2, 3].map((i) => ({ id: `id${i}`, createdAt: new Date(2026, 0, i) }));
    const p = paginate(rows, 2);
    expect(p.items).toHaveLength(2);
    expect(decodeCursor(p.nextCursor)?.id).toBe("id2");
    expect(paginate(rows, 3).nextCursor).toBeNull();
  });
});

describe("parseActivityQuery", () => {
  it("parses a full valid query", () => {
    const r = parseActivityQuery(params({ userId: "u-1", action: "DELETE_CUSTOMER", from: "2026-09-01", to: "2026-09-30", q: " דנה ", take: "500" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.userId).toBe("u-1");
    expect(r.value.action).toBe("DELETE_CUSTOMER");
    expect(r.value.q).toBe("דנה");
    expect(r.value.take).toBe(100);
    expect(r.value.gte?.toISOString()).toBe("2026-08-31T21:00:00.000Z");
  });
  it("rejects unknown actions, long search, bad cursor, bad user id", () => {
    expect(parseActivityQuery(params({ action: "DROP_TABLE" })).ok).toBe(false);
    expect(parseActivityQuery(params({ q: "x".repeat(101) })).ok).toBe(false);
    expect(parseActivityQuery(params({ cursor: "zzz" })).ok).toBe(false);
    expect(parseActivityQuery(params({ userId: "a b" })).ok).toBe(false);
  });
  it("defaults", () => {
    const r = parseActivityQuery(params({}));
    expect(r).toEqual({ ok: true, value: { userId: null, action: null, gte: undefined, lt: undefined, q: null, cursor: null, take: 50 } });
  });
  it("clampTake", () => {
    expect(clampTake("0")).toBe(50);
    expect(clampTake("-3")).toBe(50);
    expect(clampTake("abc")).toBe(50);
    expect(clampTake("20")).toBe(20);
  });
});

describe("parseAiActivityQuery", () => {
  it("validates status", () => {
    expect(parseAiActivityQuery(params({ status: "denied" })).ok).toBe(true);
    expect(parseAiActivityQuery(params({ status: "weird" })).ok).toBe(false);
    expect(parseAiActivityQuery(params({ connectionId: "../x" })).ok).toBe(false);
  });
});

describe("sanitizeXlsxCell / cleanText", () => {
  it("prefixes formula-like cells", () => {
    expect(sanitizeXlsxCell("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(sanitizeXlsxCell("+972")).toBe("'+972");
    expect(sanitizeXlsxCell("-1")).toBe("'-1");
    expect(sanitizeXlsxCell("@SUM")).toBe("'@SUM");
    expect(sanitizeXlsxCell("דנה")).toBe("דנה");
    expect(sanitizeXlsxCell(null)).toBe("");
  });
  it("cleanText strips control/bidi chars and caps", () => {
    expect(cleanText("a\n\u202eb")).toBe("a b");
    expect(cleanText("   ")).toBeNull();
    const long = cleanText("x".repeat(300));
    expect(long).toHaveLength(200);
    expect(long!.endsWith("…")).toBe(true);
  });
});
