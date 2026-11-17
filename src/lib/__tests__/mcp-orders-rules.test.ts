import {
  normalizeOrderItems,
  itemsGrossTotal,
  decideOrderLink,
  resolveOrderPet,
  canReplaceOrderLines,
  parseLocalDateTimeArg,
  OrderRuleError,
  type PriceItemInfo,
  type LinkStay,
  type LinkAppointment,
} from "@/lib/mcp/orders-rules";

const priceItems = new Map<string, PriceItemInfo>([
  ["pl1", { id: "pl1", name: "לינה בפנסיון", unit: "per_night", basePrice: 150, taxMode: "inherit" }],
  ["pl2", { id: "pl2", name: "טיפול", unit: "per_session", basePrice: 200, taxMode: "exempt" }],
]);

describe("normalizeOrderItems", () => {
  it("free-text item with defaults", () => {
    const [l] = normalizeOrderItems([{ name: " פנסיון יום ", unit_price: 120 }], new Map(), "pet1");
    expect(l).toEqual({
      name: "פנסיון יום",
      unit: "per_unit",
      quantity: 1,
      unitPrice: 120,
      priceListItemId: null,
      metadata: { petIds: ["pet1"] },
    });
  });

  it("price-list item supplies name / unit / price / tax; explicit values win", () => {
    const lines = normalizeOrderItems(
      [{ price_list_item_id: "pl1", quantity: 3 }, { price_list_item_id: "pl2", unit_price: 180, name: "טיפול מוזל" }],
      priceItems
    );
    expect(lines[0]).toMatchObject({ name: "לינה בפנסיון", unit: "per_night", quantity: 3, unitPrice: 150, taxMode: "taxable", priceListItemId: "pl1" });
    expect(lines[1]).toMatchObject({ name: "טיפול מוזל", unitPrice: 180, taxMode: "exempt", priceListItemId: "pl2" });
    expect(lines[0].metadata.petIds).toEqual([]);
  });

  it("zero price is allowed (free line)", () => {
    expect(normalizeOrderItems([{ name: "חינם", unit_price: 0 }], new Map())[0].unitPrice).toBe(0);
  });

  it.each([
    [[], /לפחות פריט אחד/],
    [[{ unit_price: 10 }], /שם פריט חובה/],
    [[{ name: "x" }], /חסר מחיר/],
    [[{ name: "x", unit_price: -1 }], /מחיר לא תקין/],
    [[{ name: "x", unit_price: 10.555 }], /2 ספרות/],
    [[{ name: "x", unit_price: 10, quantity: 0 }], /כמות לא תקינה/],
    [[{ name: "x", unit_price: 10, quantity: 1001 }], /כמות לא תקינה/],
    [[{ name: "x", unit_price: 10, unit: "per_week" }], /יחידה לא תקינה/],
    [[{ price_list_item_id: "other-business" }], /פריט המחירון לא נמצא/],
  ])("rejects %j", (items, re) => {
    expect(() => normalizeOrderItems(items as never, priceItems)).toThrow(re);
  });

  it("rejects more than 50 items", () => {
    const items = Array.from({ length: 51 }, () => ({ name: "x", unit_price: 1 }));
    expect(() => normalizeOrderItems(items, new Map())).toThrow(/מקסימום 50/);
  });

  it("gross total sums rounded lines", () => {
    expect(itemsGrossTotal([{ quantity: 3, unitPrice: 150 }, { quantity: 1.5, unitPrice: 33.33 }])).toBe(500);
  });
});

const stay: LinkStay = {
  id: "s1", customerId: "c1", petId: "p1",
  checkIn: new Date("2026-12-01T08:00:00Z"), checkOut: new Date("2026-12-04T08:00:00Z"), status: "reserved",
};
const appt: LinkAppointment = {
  id: "a1", customerId: "c1", petId: null, date: new Date("2026-12-10T00:00:00Z"), startTime: "10:00", endTime: "11:30", status: "scheduled",
};

describe("decideOrderLink", () => {
  it("no link", () => {
    expect(decideOrderLink({ kind: "none" }, "c1", null, false).relatedEntityType).toBeNull();
  });

  it("stay → BoardingStay, boarding type, stay dates, stay pet", () => {
    const d = decideOrderLink({ kind: "stay", entity: stay }, "c1", null, false);
    expect(d).toEqual({
      relatedEntityType: "BoardingStay", relatedEntityId: "s1", orderType: "boarding",
      startAt: stay.checkIn, endAt: stay.checkOut, linkPetId: "p1",
    });
  });

  it("appointment → Appointment with Israel-local times (winter UTC+2)", () => {
    const d = decideOrderLink({ kind: "appointment", entity: appt }, "c1", null, false);
    expect(d.relatedEntityType).toBe("Appointment");
    expect(d.orderType).toBeNull();
    expect(d.startAt?.toISOString()).toBe("2026-12-10T08:00:00.000Z");
    expect(d.endAt?.toISOString()).toBe("2026-12-10T09:30:00.000Z");
  });

  it("not found / other customer / no customer are always refused", () => {
    expect(() => decideOrderLink({ kind: "stay", entity: null }, "c1", null, true)).toThrow(/לא נמצא/);
    expect(() => decideOrderLink({ kind: "stay", entity: stay }, "c2", null, true)).toThrow(/לקוח אחר/);
    expect(() => decideOrderLink({ kind: "stay", entity: { ...stay, customerId: null } }, "c1", null, true)).toThrow(/לא משויך/);
  });

  it("existing active order is refused with its id unless force", () => {
    expect(() => decideOrderLink({ kind: "stay", entity: stay }, "c1", "o-old", false)).toThrow(/o-old/);
    expect(decideOrderLink({ kind: "stay", entity: stay }, "c1", "o-old", true).relatedEntityId).toBe("s1");
  });

  it("canceled appointment / stay needs force", () => {
    expect(() => decideOrderLink({ kind: "appointment", entity: { ...appt, status: "canceled" } }, "c1", null, false)).toThrow(OrderRuleError);
    expect(decideOrderLink({ kind: "appointment", entity: { ...appt, status: "canceled" } }, "c1", null, true).relatedEntityId).toBe("a1");
  });
});

describe("resolveOrderPet", () => {
  it("defaults to the link pet, accepts the same id, refuses another", () => {
    expect(resolveOrderPet(undefined, "p1")).toBe("p1");
    expect(resolveOrderPet("p1", "p1")).toBe("p1");
    expect(resolveOrderPet("p2", null)).toBe("p2");
    expect(resolveOrderPet(null, null)).toBeNull();
    expect(() => resolveOrderPet("p2", "p1")).toThrow(/pet_id/);
  });
});

describe("canReplaceOrderLines", () => {
  it("draft always", () => {
    expect(canReplaceOrderLines({ status: "draft", payments: [{ status: "paid" }] }).ok).toBe(true);
  });
  it("confirmed only with nothing paid / pending / invoiced", () => {
    expect(canReplaceOrderLines({ status: "confirmed", payments: [{ status: "canceled" }, { status: "refunded" }] }).ok).toBe(true);
    expect(canReplaceOrderLines({ status: "confirmed", payments: [{ status: "paid" }] }).ok).toBe(false);
    expect(canReplaceOrderLines({ status: "confirmed", payments: [{ status: "pending" }] }).ok).toBe(false);
    expect(canReplaceOrderLines({ status: "confirmed", payments: [], invoiceDocuments: [{ status: "issued" }] }).ok).toBe(false);
    expect(canReplaceOrderLines({ status: "confirmed", payments: [], invoiceDocuments: [{ status: "cancelled" }] }).ok).toBe(true);
  });
  it("other statuses never", () => {
    for (const s of ["in_progress", "completed", "cancelled"]) {
      expect(canReplaceOrderLines({ status: s, payments: [] }).ok).toBe(false);
    }
  });
});

describe("parseLocalDateTimeArg", () => {
  it("accepts date and date+time", () => {
    expect(parseLocalDateTimeArg("2026-12-01", "start_at")).toBe("2026-12-01");
    expect(parseLocalDateTimeArg("2026-12-01T14:30", "start_at")).toBe("2026-12-01T14:30");
  });
  it.each(["2026-02-30", "01/12/2026", "2026-12-01T25:00", "2026-12-01T10:00Z"])("rejects %s", (s) => {
    expect(() => parseLocalDateTimeArg(s, "start_at")).toThrow(OrderRuleError);
  });
});
