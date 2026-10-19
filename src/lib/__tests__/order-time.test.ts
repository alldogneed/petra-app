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

import { appointmentOrderTimes } from "@/lib/order-time";

describe("appointmentOrderTimes (order follows a moved appointment)", () => {
  it("Israel summer time: 22.10 17:30–19:30 → 14:30Z–16:30Z", () => {
    const r = appointmentOrderTimes(new Date("2026-10-22T00:00:00Z"), "17:30", "19:30");
    expect(r.startAt.toISOString()).toBe("2026-10-22T14:30:00.000Z");
    expect(r.endAt?.toISOString()).toBe("2026-10-22T16:30:00.000Z");
  });
  it("Israel winter time: 1.11 09:00 → 07:00Z, no end time → null", () => {
    const r = appointmentOrderTimes(new Date("2026-11-01T00:00:00Z"), "09:00", null);
    expect(r.startAt.toISOString()).toBe("2026-11-01T07:00:00.000Z");
    expect(r.endAt).toBeNull();
  });
});
