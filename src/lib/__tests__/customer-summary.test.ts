import {
  clampTake, parseCursor, parseAppointmentScope, pageOf, israelTodayBounds, israelNowHHMM,
  isEditableTimelineType, validateNoteDescription, redactCustomerMoney, formatShekel, MAX_NOTE_LENGTH,
} from "@/lib/customer-summary";

describe("clampTake", () => {
  it("defaults on junk", () => {
    expect(clampTake(null, 20, 50)).toBe(20);
    expect(clampTake("", 20, 50)).toBe(20);
    expect(clampTake("abc", 20, 50)).toBe(20);
  });
  it("clamps to [1, max]", () => {
    expect(clampTake("0", 20, 50)).toBe(1);
    expect(clampTake("-5", 20, 50)).toBe(1);
    expect(clampTake("500", 20, 50)).toBe(50);
    expect(clampTake("7.9", 20, 50)).toBe(7);
    expect(clampTake(30, 20, 100)).toBe(30);
  });
});

describe("parseCursor", () => {
  it("accepts uuid-like ids", () => {
    expect(parseCursor("cust-001")).toBe("cust-001");
    expect(parseCursor("3f2b1c4e-1111-2222-3333-444455556666")).toBe("3f2b1c4e-1111-2222-3333-444455556666");
  });
  it("rejects junk", () => {
    expect(parseCursor(null)).toBeNull();
    expect(parseCursor("")).toBeNull();
    expect(parseCursor("a b")).toBeNull();
    expect(parseCursor("x".repeat(65))).toBeNull();
    expect(parseCursor("'; drop")).toBeNull();
  });
});

describe("parseAppointmentScope", () => {
  it("defaults to upcoming and validates", () => {
    expect(parseAppointmentScope(null)).toBe("upcoming");
    expect(parseAppointmentScope("past")).toBe("past");
    expect(parseAppointmentScope("upcoming")).toBe("upcoming");
    expect(parseAppointmentScope("all")).toBeNull();
  });
});

describe("pageOf", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("returns next cursor when there is one more row", () => {
    expect(pageOf(rows, 2)).toEqual({ items: [{ id: "a" }, { id: "b" }], nextCursor: "b" });
  });
  it("no cursor on the last page", () => {
    expect(pageOf(rows, 3)).toEqual({ items: rows, nextCursor: null });
    expect(pageOf([], 3)).toEqual({ items: [], nextCursor: null });
  });
});

describe("Israel time helpers", () => {
  it("today bounds follow Israel, not UTC", () => {
    // 2026-03-10 23:30 UTC = 2026-03-11 01:30 in Israel (UTC+2)
    const { todayStart, tomorrowStart } = israelTodayBounds(new Date("2026-03-10T23:30:00Z"));
    expect(todayStart.toISOString()).toBe("2026-03-11T00:00:00.000Z");
    expect(tomorrowStart.toISOString()).toBe("2026-03-12T00:00:00.000Z");
  });
  it("HH:MM in Israel wall clock (summer UTC+3)", () => {
    expect(israelNowHHMM(new Date("2026-07-01T09:05:00Z"))).toBe("12:05");
    expect(israelNowHHMM(new Date("2026-07-01T21:30:00Z"))).toBe("00:30");
  });
});

describe("timeline notes", () => {
  it("only manual notes are editable", () => {
    expect(isEditableTimelineType("note")).toBe(true);
    expect(isEditableTimelineType("MANUAL_NOTE")).toBe(true);
    expect(isEditableTimelineType("customer_created")).toBe(false);
    expect(isEditableTimelineType("whatsapp_sent")).toBe(false);
    expect(isEditableTimelineType(null)).toBe(false);
  });
  it("validates description", () => {
    expect(validateNoteDescription("  hi  ")).toEqual({ ok: true, value: "hi" });
    expect(validateNoteDescription("   ").ok).toBe(false);
    expect(validateNoteDescription(5).ok).toBe(false);
    expect(validateNoteDescription("x".repeat(MAX_NOTE_LENGTH + 1)).ok).toBe(false);
    expect(validateNoteDescription("x".repeat(MAX_NOTE_LENGTH)).ok).toBe(true);
  });
});

describe("redactCustomerMoney", () => {
  const customer = {
    id: "c1",
    name: "דנה",
    payments: [{ id: "p1", amount: 100 }],
    orders: [
      {
        id: "o1", status: "confirmed", subtotal: 200, discountAmount: 10, taxTotal: 30, total: 220,
        lines: [{ id: "l1", name: "אילוף", quantity: 2, unitPrice: 100, lineSubtotal: 200, lineTotal: 200 }],
        payments: [{ id: "op1", amount: 50, status: "paid" }],
      },
    ],
    summary: { balance: { outstanding: 170, ordersOutstanding: 170, pendingAmount: 0, totalPaid: 50 }, counts: { orders: 1 } },
  };
  it("zeroes money, keeps shape and non-money fields", () => {
    const r = redactCustomerMoney(customer);
    expect(r.payments).toEqual([]);
    expect(r.summary.balance).toBeNull();
    expect(r.summary.counts).toEqual({ orders: 1 });
    expect(r.orders[0]).toMatchObject({ id: "o1", status: "confirmed", subtotal: 0, discountAmount: 0, taxTotal: 0, total: 0 });
    expect(r.orders[0].lines[0]).toEqual({ id: "l1", name: "אילוף", quantity: 2, unitPrice: 0, lineSubtotal: 0, lineTotal: 0 });
    expect(r.orders[0].payments[0]).toEqual({ id: "op1", amount: 0, status: "paid" });
    expect(r.name).toBe("דנה");
  });
  it("does not mutate the input", () => {
    redactCustomerMoney(customer);
    expect(customer.orders[0].total).toBe(220);
    expect(customer.payments).toHaveLength(1);
  });
});

describe("formatShekel", () => {
  it("rounds to agorot", () => {
    expect(formatShekel(0)).toBe("₪0");
    expect(formatShekel(12.345)).toMatch(/^₪12[.,]35$/);
  });
});
