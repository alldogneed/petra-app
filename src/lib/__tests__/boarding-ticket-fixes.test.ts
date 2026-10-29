import { staysOverlap, occupiedDays, israelDayKey, nextDayKey } from "@/lib/boarding-overlap";
import { searchVariants, normalizeHebrewPunct } from "@/lib/text-variants";

describe("boarding overlap — check-out day is a turnover day", () => {
  const leaving = { checkIn: new Date("2026-09-27T05:00:00Z"), checkOut: new Date("2026-10-01T14:00:00Z") }; // 17:00 Israel
  it("a dog leaving 1/10 and a dog arriving 1/10 share the room", () => {
    const arriving = { checkIn: new Date("2026-10-01T05:00:00Z"), checkOut: new Date("2026-10-05T14:00:00Z") };
    expect(staysOverlap(leaving, arriving)).toBe(false);
    expect(staysOverlap(arriving, leaving)).toBe(false);
  });
  it("a real overlap is still caught", () => {
    expect(staysOverlap(leaving, { checkIn: "2026-09-30", checkOut: "2026-10-03" })).toBe(true);
  });
  it("open-ended stays occupy everything after their start", () => {
    expect(staysOverlap({ checkIn: "2026-10-01", checkOut: null }, { checkIn: "2027-01-01", checkOut: "2027-01-02" })).toBe(true);
    expect(staysOverlap({ checkIn: "2026-10-05", checkOut: null }, { checkIn: "2026-10-01", checkOut: "2026-10-05" })).toBe(false);
  });
  it("a same-day stay occupies its day", () => {
    expect(occupiedDays("2026-10-01", "2026-10-01")).toEqual(["2026-10-01", "2026-10-02"]);
    expect(staysOverlap({ checkIn: "2026-10-01", checkOut: "2026-10-01" }, { checkIn: "2026-10-01", checkOut: "2026-10-03" })).toBe(true);
  });
  it("uses the Israel calendar day (winter + summer)", () => {
    expect(israelDayKey(new Date("2026-10-31T22:30:00Z"))).toBe("2026-11-01"); // UTC+2
    expect(israelDayKey(new Date("2026-07-31T21:30:00Z"))).toBe("2026-08-01"); // UTC+3
    expect(nextDayKey("2026-12-31")).toBe("2027-01-01");
  });
});

describe("geresh spellings", () => {
  it("normalizes every geresh / gershayim form", () => {
    expect(normalizeHebrewPunct("פאץ׳")).toBe("פאץ'");
    expect(normalizeHebrewPunct("בורוביץ’")).toBe("בורוביץ'");
    expect(normalizeHebrewPunct("צה״ל")).toBe('צה"ל');
  });
  it("searchVariants covers ', ׳, ’ and the bare text", () => {
    const v = searchVariants("פאץ'");
    expect(v).toEqual(expect.arrayContaining(["פאץ'", "פאץ׳", "פאץ’", "פאץ"]));
  });
  it("plain text → one variant", () => {
    expect(searchVariants("רקס")).toEqual(["רקס"]);
  });
});
