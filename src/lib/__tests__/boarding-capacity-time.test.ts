import { staysOverlapAt } from "@/lib/boarding-overlap";

// Israel winter = UTC+2. Times below are instants.
const at = (s: string) => new Date(s);

describe("staysOverlapAt — room capacity by date + time (גבעת הכלבים 17/11/2026)", () => {
  it("out 17:00, in 19:00 the same day → no overlap", () => {
    const leaving = { checkIn: at("2026-12-14T12:00:00Z"), checkOut: at("2026-12-17T15:00:00Z") }; // out 17:00 IL
    const arriving = { checkIn: at("2026-12-17T17:00:00Z"), checkOut: at("2026-12-20T09:00:00Z") }; // in 19:00 IL
    expect(staysOverlapAt(leaving, arriving)).toBe(false);
  });
  it("a day stay (09:00–16:00) does not block the night after it", () => {
    const day = { checkIn: at("2026-12-17T07:00:00Z"), checkOut: at("2026-12-17T14:00:00Z") };
    const night = { checkIn: at("2026-12-17T17:00:00Z"), checkOut: at("2026-12-18T09:00:00Z") };
    expect(staysOverlapAt(day, night)).toBe(false);
  });
  it("arrival before the other dog leaves → overlap", () => {
    const leaving = { checkIn: at("2026-12-14T12:00:00Z"), checkOut: at("2026-12-17T15:00:00Z") };
    const early = { checkIn: at("2026-12-17T10:00:00Z"), checkOut: at("2026-12-19T09:00:00Z") };
    expect(staysOverlapAt(leaving, early)).toBe(true);
  });
  it("out 12:00 / in 12:00 → fits (half-open)", () => {
    const a = { checkIn: at("2026-12-10T10:00:00Z"), checkOut: at("2026-12-17T10:00:00Z") };
    const b = { checkIn: at("2026-12-17T10:00:00Z"), checkOut: null };
    expect(staysOverlapAt(a, b)).toBe(false);
  });
  it("open-ended stay blocks everything after it", () => {
    const open = { checkIn: at("2026-12-10T10:00:00Z"), checkOut: null };
    const later = { checkIn: at("2027-01-10T10:00:00Z"), checkOut: at("2027-01-12T10:00:00Z") };
    expect(staysOverlapAt(open, later)).toBe(true);
  });
  it("bare days fall back to the day rule (check-out day free)", () => {
    expect(staysOverlapAt({ checkIn: "2026-12-14", checkOut: "2026-12-17" }, { checkIn: "2026-12-17", checkOut: "2026-12-19" })).toBe(false);
    expect(staysOverlapAt({ checkIn: "2026-12-14", checkOut: "2026-12-18" }, { checkIn: "2026-12-17", checkOut: "2026-12-19" })).toBe(true);
  });
  it("zero-length stay falls back to the day rule", () => {
    const zero = { checkIn: at("2026-12-17T10:00:00Z"), checkOut: at("2026-12-17T10:00:00Z") };
    const sameDay = { checkIn: at("2026-12-17T17:00:00Z"), checkOut: at("2026-12-18T09:00:00Z") };
    expect(staysOverlapAt(zero, sameDay)).toBe(true);
  });
});
