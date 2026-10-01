/**
 * Tests for report date helpers — Israel-local day bounds (incl. DST),
 * month bucketing and day-of-week near midnight.
 */
import {
  israelDayStart, israelDayEnd, israelDayOfWeek, israelMonthKey,
  lastMonthKeys, monthKeysBetween, isYmd, pct, pctChange, prevYearMonthKey,
} from "@/lib/report-dates";

describe("israel day bounds", () => {
  it("winter day starts at 22:00Z the previous day", () => {
    expect(israelDayStart("2026-01-15").toISOString()).toBe("2026-01-14T22:00:00.000Z");
  });
  it("summer day starts at 21:00Z and ends at 20:59:59.999Z", () => {
    expect(israelDayStart("2026-07-15").toISOString()).toBe("2026-07-14T21:00:00.000Z");
    expect(israelDayEnd("2026-07-15").toISOString()).toBe("2026-07-15T20:59:59.999Z");
  });
});

describe("bucketing", () => {
  it("uses Israel time for day of week and month", () => {
    expect(israelDayOfWeek(new Date("2026-10-03T22:30:00Z"))).toBe(0); // Sunday 01:30 in Israel
    expect(israelMonthKey(new Date("2026-09-30T22:30:00Z"))).toBe("2026-10");
  });
  it("lists month keys", () => {
    expect(lastMonthKeys(3, new Date("2026-02-10T10:00:00Z"))).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(monthKeysBetween(new Date("2025-11-20T10:00:00Z"), new Date("2026-02-01T10:00:00Z")))
      .toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(prevYearMonthKey("2026-03")).toBe("2025-03");
  });
});

describe("validation and rates", () => {
  it("rejects impossible dates", () => {
    expect(isYmd("2026-02-30")).toBe(false);
    expect(isYmd("2026-02-28")).toBe(true);
    expect(isYmd("2026-2-28")).toBe(false);
  });
  it("pct is null without a denominator", () => {
    expect(pct(1, 0)).toBeNull();
    expect(pct(1, 3)).toBe(33);
    expect(pctChange(5, 0)).toBeNull();
    expect(pctChange(0, 0)).toBe(0);
    expect(pctChange(15, 10)).toBe(50);
  });
});
