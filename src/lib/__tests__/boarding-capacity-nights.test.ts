import { staysShareNight } from "@/lib/boarding-overlap";

// Instants in Israel winter (UTC+2).
const at = (s: string) => new Date(s);

describe("staysShareNight — room capacity by nights, hours ignored (גבעת הכלבים 18/11/2026)", () => {
  it("in 08:00 while the other dog leaves 19:00 the same day → fits", () => {
    const leaving = { checkIn: at("2026-12-14T12:00:00Z"), checkOut: at("2026-12-17T17:00:00Z") }; // out 19:00 IL
    const arriving = { checkIn: at("2026-12-17T06:00:00Z"), checkOut: at("2026-12-20T09:00:00Z") }; // in 08:00 IL
    expect(staysShareNight(leaving, arriving)).toBe(false);
  });
  it("a day stay never blocks the room (no night)", () => {
    const day = { checkIn: at("2026-12-17T07:00:00Z"), checkOut: at("2026-12-17T14:00:00Z") };
    const night = { checkIn: at("2026-12-17T06:00:00Z"), checkOut: at("2026-12-18T09:00:00Z") };
    expect(staysShareNight(day, night)).toBe(false);
    expect(staysShareNight(night, day)).toBe(false);
  });
  it("two stays sharing a night → overlap", () => {
    const a = { checkIn: at("2026-12-14T12:00:00Z"), checkOut: at("2026-12-18T09:00:00Z") };
    const b = { checkIn: at("2026-12-17T12:00:00Z"), checkOut: at("2026-12-19T09:00:00Z") };
    expect(staysShareNight(a, b)).toBe(true);
  });
  it("open-ended stay blocks the nights after it", () => {
    const open = { checkIn: at("2026-12-10T10:00:00Z"), checkOut: null };
    const later = { checkIn: at("2027-01-10T10:00:00Z"), checkOut: at("2027-01-12T10:00:00Z") };
    expect(staysShareNight(open, later)).toBe(true);
  });
  it("bare day strings work the same", () => {
    expect(staysShareNight({ checkIn: "2026-12-14", checkOut: "2026-12-17" }, { checkIn: "2026-12-17", checkOut: "2026-12-19" })).toBe(false);
    expect(staysShareNight({ checkIn: "2026-12-14", checkOut: "2026-12-18" }, { checkIn: "2026-12-17", checkOut: "2026-12-19" })).toBe(true);
  });
  it("a late-evening check-out (23:30 IL) stays on its Israel day", () => {
    const a = { checkIn: at("2026-12-14T12:00:00Z"), checkOut: at("2026-12-17T21:30:00Z") };
    const b = { checkIn: at("2026-12-17T08:00:00Z"), checkOut: at("2026-12-18T08:00:00Z") };
    expect(staysShareNight(a, b)).toBe(false);
  });
});
