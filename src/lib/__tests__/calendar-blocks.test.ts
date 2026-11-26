import { blockSegmentForDay, blockLabel } from "@/lib/calendar-blocks";

const S = 8 * 60, E = 21 * 60;
// Israel winter = UTC+2
const b = (startAt: string, endAt: string, extra = {}) => ({ id: "x", startAt, endAt, reason: null, ...extra });

describe("blockSegmentForDay", () => {
  it("clips a timed block to the day", () => {
    expect(blockSegmentForDay(b("2026-11-26T08:00:00Z", "2026-11-26T10:30:00Z"), "2026-11-26", S, E))
      .toEqual({ startTime: "10:00", endTime: "12:30", fullDay: false });
  });
  it("multi-day holiday block (UTC midnight-ish) covers the middle day fully", () => {
    const blk = b("2026-11-25T00:00:00Z", "2026-11-27T23:59:59Z");
    expect(blockSegmentForDay(blk, "2026-11-26", S, E)).toEqual({ startTime: "08:00", endTime: "21:00", fullDay: true });
    expect(blockSegmentForDay(blk, "2026-11-24", S, E)).toBeNull();
  });
  it("outside visible hours → null; end at midnight belongs to the day before", () => {
    expect(blockSegmentForDay(b("2026-11-26T19:30:00Z", "2026-11-26T21:00:00Z"), "2026-11-26", S, E)).toBeNull();
    expect(blockSegmentForDay(b("2026-11-25T20:00:00Z", "2026-11-26T22:00:00Z"), "2026-11-27", S, E)).toBeNull();
  });
  it("labels", () => {
    expect(blockLabel(b("a", "b", { reason: "חופש" }))).toBe("חסום · חופש");
    expect(blockLabel(b("a", "b", { user: { id: "u", name: "דור" } }))).toBe("היעדרות: דור");
  });
});
