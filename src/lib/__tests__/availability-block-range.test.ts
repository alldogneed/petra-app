import { parseBlockRange, blockMemberName, MAX_BLOCK_RANGE_DAYS } from "../availability-block-range";

describe("parseBlockRange", () => {
  it("returns Israel day bounds (winter, +2h)", () => {
    const r = parseBlockRange("2026-12-01", "2026-12-07");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.start.toISOString()).toBe("2026-11-30T22:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-12-07T21:59:59.999Z");
  });

  it("handles summer time (+3h)", () => {
    const r = parseBlockRange("2026-07-10", "2026-07-10");
    expect(r.ok && r.start.toISOString()).toBe("2026-07-09T21:00:00.000Z");
  });

  it("requires both params", () => {
    expect(parseBlockRange("2026-12-01", null).ok).toBe(false);
    expect(parseBlockRange(null, "2026-12-01").ok).toBe(false);
  });

  it("rejects bad formats and reversed ranges", () => {
    expect(parseBlockRange("2026-13-01", "2026-12-01").ok).toBe(false);
    expect(parseBlockRange("1/12/2026", "2026-12-01").ok).toBe(false);
    expect(parseBlockRange("2026-12-05", "2026-12-01").ok).toBe(false);
  });

  it("caps the range", () => {
    expect(parseBlockRange("2026-01-01", "2026-03-03").ok).toBe(true); // 62 days
    expect(MAX_BLOCK_RANGE_DAYS).toBe(62);
    expect(parseBlockRange("2026-01-01", "2026-03-04").ok).toBe(false); // 63 days
  });
});

describe("blockMemberName", () => {
  it("is empty for a business block", () => {
    expect(blockMemberName({ userId: null, user: null })).toBe("");
  });
  it("returns the member name, with a fallback", () => {
    expect(blockMemberName({ userId: "u1", user: { id: "u1", name: " דנה " } })).toBe("דנה");
    expect(blockMemberName({ userId: "u1", user: null })).toBe("איש צוות");
  });
});
