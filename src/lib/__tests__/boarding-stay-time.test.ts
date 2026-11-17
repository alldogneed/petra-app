import { parseOrderDateTime } from "@/lib/order-time";

// The boarding service parses check-in/out with the same rule (stayTime in services/boarding.ts).
describe("boarding stay times are Israel wall-clock", () => {
  it("winter: 14:00 Israel = 12:00Z", () => {
    expect(parseOrderDateTime("2026-12-17T14:00:00")?.toISOString()).toBe("2026-12-17T12:00:00.000Z");
  });
  it("summer: 14:00 Israel = 11:00Z", () => {
    expect(parseOrderDateTime("2026-07-17T14:00:00")?.toISOString()).toBe("2026-07-17T11:00:00.000Z");
  });
  it("late evening stays on the same Israel day", () => {
    expect(parseOrderDateTime("2026-12-17T23:30:00")?.toISOString()).toBe("2026-12-17T21:30:00.000Z");
  });
  it("an instant with Z is kept (edit modal sends toISOString)", () => {
    expect(parseOrderDateTime("2026-12-17T12:00:00.000Z")?.toISOString()).toBe("2026-12-17T12:00:00.000Z");
  });
});
