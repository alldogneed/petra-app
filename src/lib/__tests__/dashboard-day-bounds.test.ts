import { israelDayEnd, israelDayStart, israelMonthKey, lastMonthKeys } from "@/lib/report-dates";

// The dashboard (getDashboardMetrics) builds its "today" / "this month" bounds from these
// helpers. Israel is UTC+2 in winter and UTC+3 in summer — a fixed "+03:00" was an hour off
// after 25/10/2026.
describe("dashboard Israel-day bounds (DST-safe)", () => {
  it("winter day starts at 22:00Z the previous day", () => {
    expect(israelDayStart("2026-10-29").toISOString()).toBe("2026-10-28T22:00:00.000Z");
    expect(israelDayEnd("2026-10-29").toISOString()).toBe("2026-10-29T21:59:59.999Z");
  });

  it("summer day starts at 21:00Z the previous day", () => {
    expect(israelDayStart("2026-07-15").toISOString()).toBe("2026-07-14T21:00:00.000Z");
    expect(israelDayEnd("2026-07-15").toISOString()).toBe("2026-07-15T20:59:59.999Z");
  });

  it("DST switch day (25/10/2026) is 25 hours long", () => {
    const len = israelDayEnd("2026-10-25").getTime() + 1 - israelDayStart("2026-10-25").getTime();
    expect(len).toBe(25 * 60 * 60 * 1000);
  });

  it("month start in winter + revenue month buckets follow Israel time", () => {
    expect(israelDayStart("2026-11-01").toISOString()).toBe("2026-10-31T22:00:00.000Z");
    // 23:30 Israel on 31/10 is still October
    expect(israelMonthKey(new Date("2026-10-31T21:30:00Z"))).toBe("2026-10");
    expect(israelMonthKey(new Date("2026-10-31T22:30:00Z"))).toBe("2026-11");
    expect(lastMonthKeys(6, new Date("2026-10-29T10:00:00Z"))).toEqual([
      "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
    ]);
  });
});
