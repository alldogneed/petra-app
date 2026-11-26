import { dayMovement, weekSummary, weekStart, addDays, inBoardingAtEndOf } from "@/lib/boarding-movements";

// 10:00 Israel = 08:00Z (winter)
const at = (day: string, hhmm = "08:00") => `${day}T${hhmm}:00.000Z`;
const stays = [
  { id: "a", checkIn: at("2026-11-22"), checkOut: at("2026-11-24"), status: "checked_in" },
  { id: "b", checkIn: at("2026-11-24"), checkOut: at("2026-11-27"), status: "reserved" },
  { id: "c", checkIn: at("2026-11-24"), checkOut: null, status: "reserved" },
  { id: "x", checkIn: at("2026-11-24"), checkOut: at("2026-11-25"), status: "canceled" },
  // 23:30 Israel on the 23rd = 21:30Z — still the 23rd
  { id: "d", checkIn: at("2026-11-23", "21:30"), checkOut: at("2026-11-24", "06:00"), status: "checked_out" },
];

describe("boarding movements", () => {
  it("arrivals / departures by Israel day, canceled ignored", () => {
    const m = dayMovement(stays, "2026-11-24");
    expect(m.arrivals.map((s) => s.id).sort()).toEqual(["b", "c"]);
    expect(m.departures.map((s) => s.id).sort()).toEqual(["a", "d"]);
    expect(m.inBoarding).toBe(2);
  });
  it("end-of-day count includes late arrivals of that day", () => {
    expect(inBoardingAtEndOf(stays, "2026-11-23")).toBe(2); // a + d
  });
  it("open-ended checked-out stay no longer counts", () => {
    expect(inBoardingAtEndOf([{ id: "z", checkIn: at("2026-11-20"), checkOut: null, status: "checked_out" }], "2026-11-24")).toBe(0);
  });
  it("week starts on Sunday and sums the week", () => {
    expect(weekStart("2026-11-24")).toBe("2026-11-22"); // Tuesday → Sunday
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    const w = weekSummary(stays, "2026-11-22");
    expect(w.days).toHaveLength(7);
    expect(w.totalArrivals).toBe(4); // a, d, b, c
    expect(w.totalDepartures).toBe(3); // a, d, b
  });
});
