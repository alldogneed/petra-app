import {
  shiftIsoByIsraelDays,
  dragDayDelta,
  isStayDraggable,
  buildStayMovePatch,
  UNASSIGNED_ROW,
} from "@/lib/boarding-drag";

describe("shiftIsoByIsraelDays", () => {
  it("keeps the Israel time of day (summer)", () => {
    // 14:00 Israel (IDT, +03:00) on 10/7/2026
    expect(shiftIsoByIsraelDays("2026-07-10T11:00:00.000Z", 2)).toBe("2026-07-12T11:00:00.000Z");
    expect(shiftIsoByIsraelDays("2026-07-10T11:00:00.000Z", -3)).toBe("2026-07-07T11:00:00.000Z");
  });

  it("keeps the wall-clock time across the DST switch (October)", () => {
    // 14:00 IDT on 23/10/2026 → Israel falls back on 25/10 → 14:00 IST = 12:00Z
    expect(shiftIsoByIsraelDays("2026-10-23T11:00:00.000Z", 4)).toBe("2026-10-27T12:00:00.000Z");
    // and back
    expect(shiftIsoByIsraelDays("2026-10-27T12:00:00.000Z", -4)).toBe("2026-10-23T11:00:00.000Z");
  });

  it("handles a late-evening time that is the next UTC day in Israel terms", () => {
    // 23:30 Israel on 15/11/2026 (IST +02:00) = 21:30Z
    expect(shiftIsoByIsraelDays("2026-11-15T21:30:00.000Z", 1)).toBe("2026-11-16T21:30:00.000Z");
    // 00:30 Israel on 16/11 = 22:30Z on 15/11
    expect(shiftIsoByIsraelDays("2026-11-15T22:30:00.000Z", 1)).toBe("2026-11-16T22:30:00.000Z");
  });

  it("crosses month/year boundaries and keeps seconds + ms", () => {
    expect(shiftIsoByIsraelDays("2026-12-31T08:15:42.123Z", 1)).toBe("2027-01-01T08:15:42.123Z");
  });

  it("zero days returns the same instant", () => {
    expect(shiftIsoByIsraelDays("2026-07-10T11:00:00.000Z", 0)).toBe("2026-07-10T11:00:00.000Z");
  });

  it("throws on an invalid date", () => {
    expect(() => shiftIsoByIsraelDays("nope", 1)).toThrow();
  });
});

describe("dragDayDelta", () => {
  it("snaps to whole days", () => {
    expect(dragDayDelta(0, 44)).toBe(0);
    expect(dragDayDelta(21, 44)).toBe(0);
    expect(dragDayDelta(23, 44)).toBe(1);
    expect(dragDayDelta(90, 44)).toBe(2);
    expect(dragDayDelta(-70, 44)).toBe(-2);
    expect(Object.is(dragDayDelta(-10, 44), 0)).toBe(true);
  });
  it("is 0 for a missing width", () => {
    expect(dragDayDelta(100, 0)).toBe(0);
  });
});

describe("isStayDraggable", () => {
  it("only reserved / checked_in", () => {
    expect(isStayDraggable("reserved")).toBe(true);
    expect(isStayDraggable("checked_in")).toBe(true);
    expect(isStayDraggable("checked_out")).toBe(false);
    expect(isStayDraggable("canceled")).toBe(false);
  });
});

describe("buildStayMovePatch", () => {
  const stay = { checkIn: "2026-07-10T11:00:00.000Z", checkOut: "2026-07-13T07:00:00.000Z", roomId: "r1" };

  it("nothing changed → null", () => {
    expect(buildStayMovePatch(stay, 0, "r1")).toBeNull();
  });

  it("room only", () => {
    expect(buildStayMovePatch(stay, 0, "r2")).toEqual({ roomId: "r2" });
    expect(buildStayMovePatch(stay, 0, UNASSIGNED_ROW)).toEqual({ roomId: null });
    expect(buildStayMovePatch({ ...stay, roomId: null }, 0, UNASSIGNED_ROW)).toBeNull();
  });

  it("dates only — both ends shift, length kept", () => {
    expect(buildStayMovePatch(stay, 2, "r1")).toEqual({
      checkIn: "2026-07-12T11:00:00.000Z",
      checkOut: "2026-07-15T07:00:00.000Z",
    });
  });

  it("room + dates in one patch", () => {
    expect(buildStayMovePatch(stay, -1, "r3")).toEqual({
      roomId: "r3",
      checkIn: "2026-07-09T11:00:00.000Z",
      checkOut: "2026-07-12T07:00:00.000Z",
    });
  });

  it("open-ended stay shifts check-in only", () => {
    expect(buildStayMovePatch({ ...stay, checkOut: null }, 3, "r1")).toEqual({
      checkIn: "2026-07-13T11:00:00.000Z",
    });
  });
});
