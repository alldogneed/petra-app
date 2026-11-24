import { computeStayBilling, stayOrderAmount } from "@/lib/stay-billing";

describe("computeStayBilling", () => {
  it("no order → total and balance null, payments still counted", () => {
    const r = computeStayBilling(["s1"], [], [{ id: "p1", amount: 100, status: "paid", orderId: null, boardingStayId: "s1" }]);
    expect(r.s1).toEqual({ orderId: null, orderCount: 0, total: null, paid: 100, pending: 0, balance: null });
  });
  it("counts a payment linked both ways once and skips cancelled orders", () => {
    const r = computeStayBilling(
      ["s1"],
      [
        { id: "o2", total: 500, status: "confirmed", relatedEntityId: "s1" },
        { id: "o1", total: 999, status: "cancelled", relatedEntityId: "s1" },
      ],
      [
        { id: "p1", amount: 200, status: "paid", orderId: "o2", boardingStayId: "s1" },
        { id: "p2", amount: 50, status: "pending", orderId: "o2", boardingStayId: null },
        { id: "p3", amount: 70, status: "canceled", orderId: "o2", boardingStayId: null },
        { id: "p4", amount: 30, status: "paid", orderId: "oX", boardingStayId: "s2" },
      ]
    );
    expect(r.s1).toEqual({ orderId: "o2", orderCount: 1, total: 500, paid: 200, pending: 50, balance: 300 });
  });
  it("balance never below zero", () => {
    const r = computeStayBilling(["s1"], [{ id: "o", total: 100, status: "completed", relatedEntityId: "s1" }],
      [{ id: "p", amount: 150, status: "paid", orderId: "o", boardingStayId: null }]);
    expect(r.s1.balance).toBe(0);
  });
});

describe("stayOrderAmount", () => {
  it("nights × price × dogs", () => {
    expect(stayOrderAmount(3, 120, 2)).toBe(720);
    expect(stayOrderAmount(0, 120)).toBe(0);
  });
});
