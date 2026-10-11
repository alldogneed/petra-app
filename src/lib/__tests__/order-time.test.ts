import { parseOrderDateTime } from "../order-time";

describe("parseOrderDateTime", () => {
  it("reads an offset-less summer time as Israel time (UTC+3)", () => {
    expect(parseOrderDateTime("2026-07-16T18:00:00")?.toISOString()).toBe("2026-07-16T15:00:00.000Z");
    expect(parseOrderDateTime("2026-07-16T18:00")?.toISOString()).toBe("2026-07-16T15:00:00.000Z");
  });
  it("reads an offset-less winter time as Israel time (UTC+2)", () => {
    expect(parseOrderDateTime("2026-12-01T09:30:00")?.toISOString()).toBe("2026-12-01T07:30:00.000Z");
  });
  it("keeps strings that already carry an offset", () => {
    expect(parseOrderDateTime("2026-07-16T15:00:00.000Z")?.toISOString()).toBe("2026-07-16T15:00:00.000Z");
    expect(parseOrderDateTime("2026-07-16T18:00:00+03:00")?.toISOString()).toBe("2026-07-16T15:00:00.000Z");
  });
  it("date-only = local midnight", () => {
    expect(parseOrderDateTime("2026-07-16")?.toISOString()).toBe("2026-07-15T21:00:00.000Z");
  });
  it("empty / invalid → undefined", () => {
    expect(parseOrderDateTime(undefined)).toBeUndefined();
    expect(parseOrderDateTime("")).toBeUndefined();
    expect(parseOrderDateTime("not a date")).toBeUndefined();
  });
});
