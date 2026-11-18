import {
  addDayKey,
  dayKeyDiff,
  dayKeyWeekday,
  windowAround,
  windowContains,
  scrollLeftForDay,
  extendWindowForScroll,
  monthSegments,
  firstWeekdayIndex,
} from "@/lib/timeline-window";

describe("day keys", () => {
  it("adds days across months, years and DST", () => {
    expect(addDayKey("2026-11-25", 25)).toBe("2026-12-20");
    expect(addDayKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDayKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDayKey("2026-10-24", 2)).toBe("2026-10-26"); // Israel DST switch 25/10
  });
  it("diffs and weekdays", () => {
    expect(dayKeyDiff("2026-11-25", "2026-12-20")).toBe(25);
    expect(dayKeyDiff("2026-12-20", "2026-11-25")).toBe(-25);
    expect(dayKeyWeekday("2026-11-18")).toBe(3); // Wednesday
  });
});

describe("windowAround / windowContains / scrollLeftForDay", () => {
  const win = windowAround("2026-11-18");
  it("spans 60 days before and 180 after", () => {
    expect(win).toEqual({ startKey: "2026-09-19", days: 240 });
    expect(dayKeyDiff(win.startKey, "2026-11-18")).toBe(60);
  });
  it("contains with margins", () => {
    expect(windowContains(win, "2026-11-18", 30)).toBe(true);
    expect(windowContains(win, "2026-09-25", 30)).toBe(false);
    expect(windowContains(win, "2027-05-20")).toBe(false);
  });
  it("puts the anchor near the left edge", () => {
    expect(scrollLeftForDay(win, "2026-11-18", 44)).toBe(59 * 44);
    expect(scrollLeftForDay(win, "2026-11-18", 28, 0)).toBe(60 * 28);
    expect(scrollLeftForDay(win, "2026-09-19", 44)).toBe(0);
  });
});

describe("extendWindowForScroll", () => {
  const win = { startKey: "2026-09-19", days: 240 };
  it("does nothing in the middle", () => {
    expect(extendWindowForScroll(win, { scrollLeft: 60 * 44, viewportWidth: 1000, dayW: 44 })).toBeNull();
  });
  it("prepends near the start and reports the scroll shift", () => {
    const r = extendWindowForScroll(win, { scrollLeft: 5 * 44, viewportWidth: 1000, dayW: 44 });
    expect(r).toEqual({ win: { startKey: "2026-06-21", days: 330 }, shiftPx: 90 * 44 });
  });
  it("appends near the end without a shift", () => {
    const r = extendWindowForScroll(win, { scrollLeft: 220 * 44 - 1000, viewportWidth: 1000, dayW: 44 });
    expect(r).toEqual({ win: { startKey: "2026-09-19", days: 330 }, shiftPx: 0 });
  });
  it("caps the window, trimming the far start when appending", () => {
    const big = { startKey: "2026-01-01", days: 300 };
    const r = extendWindowForScroll(big, { scrollLeft: 290 * 10 - 100, viewportWidth: 100, dayW: 10 }, { max: 320 });
    expect(r).not.toBeNull();
    expect(r!.win.days).toBe(320);
    expect(r!.win.startKey).toBe(addDayKey("2026-01-01", 70));
    expect(r!.shiftPx).toBe(-700);
  });
  it("caps the window when prepending by dropping the far end", () => {
    const r = extendWindowForScroll(win, { scrollLeft: 0, viewportWidth: 500, dayW: 10 }, { max: 300 });
    expect(r).toEqual({ win: { startKey: "2026-06-21", days: 300 }, shiftPx: 900 });
  });
});

describe("monthSegments / firstWeekdayIndex", () => {
  it("splits the window by month", () => {
    const segs = monthSegments({ startKey: "2026-11-25", days: 40 });
    expect(segs).toEqual([
      { month: "2026-11", startIndex: 0, length: 6 },
      { month: "2026-12", startIndex: 6, length: 31 },
      { month: "2027-01", startIndex: 37, length: 3 },
    ]);
    expect(segs.reduce((s, x) => s + x.length, 0)).toBe(40);
  });
  it("finds the first Saturday", () => {
    expect(firstWeekdayIndex("2026-11-18", 6)).toBe(3); // Wed → Sat
    expect(firstWeekdayIndex("2026-11-21", 6)).toBe(0);
  });
});
