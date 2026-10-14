import { aggregateOutstandingBalances } from "@/lib/outstanding-balances";

const d = (iso: string) => new Date(iso);
const cust = (id: string, name: string) => ({ id, name });

describe("aggregateOutstandingBalances", () => {
  it("sums order remainders + unlinked pending payments per customer, sorted desc", () => {
    const res = aggregateOutstandingBalances(
      [
        { id: "o1", total: 500, createdAt: d("2026-05-01"), customerId: "c1", customer: cust("c1", "דנה"), payments: [{ amount: 200 }] },
        { id: "o2", total: 100, createdAt: d("2026-04-01"), customerId: "c1", customer: cust("c1", "דנה"), payments: [{ amount: 100 }] }, // fully paid
        { id: "o3", total: 1000, createdAt: d("2026-06-01"), customerId: "c2", customer: cust("c2", "יוסי"), payments: [] },
      ],
      [
        { id: "p1", amount: 300, createdAt: d("2026-03-01"), orderId: "o1", customerId: "c1", customer: cust("c1", "דנה") }, // linked to counted order → skipped
        { id: "p2", amount: 50, createdAt: d("2026-02-01"), orderId: null, customerId: "c1", customer: cust("c1", "דנה") },
        { id: "p3", amount: 80, createdAt: d("2026-01-01"), orderId: "o2", customerId: "c3", customer: null }, // o2 not counted → counted
      ]
    );
    expect(res.rows.map((r) => [r.id, r.total])).toEqual([
      ["c2", 1000],
      ["c1", 350],
      ["c3", 80],
    ]);
    const c1 = res.rows[1];
    expect(c1.orderIds).toEqual(["o1"]);
    expect(c1.ordersOutstanding).toBe(300);
    expect(c1.pendingIds).toEqual(["p2"]);
    expect(c1.oldest.toISOString()).toBe(d("2026-02-01").toISOString());
    expect(res.rows[2].name).toBe("");
    expect(res.grandTotal).toBe(1430);
  });

  it("ignores sub-agora remainders and returns empty", () => {
    const res = aggregateOutstandingBalances(
      [{ id: "o", total: 100, createdAt: d("2026-01-01"), customerId: "c", customer: cust("c", "x"), payments: [{ amount: 99.995 }] }],
      []
    );
    expect(res).toEqual({ rows: [], grandTotal: 0 });
  });

  it("general paid payments with no order pay off the customer's debt (the reported case)", () => {
    const order = { id: "o1", total: 1800, createdAt: d("2026-09-23"), customerId: "c1", customer: cust("c1", "גל"), payments: [] };
    const paid = (amount: number) => ({ customerId: "c1", amount, appointmentId: null, boardingStayId: null });
    // Before: three unlinked ₪1,800 payments did not count → ₪1,800 debt.
    expect(aggregateOutstandingBalances([order], [], [paid(1800), paid(1800), paid(1800)]).rows).toEqual([]);
    // Partial credit reduces the debt, oldest order first.
    const res = aggregateOutstandingBalances(
      [order, { ...order, id: "o2", createdAt: d("2026-10-01") }],
      [],
      [paid(2000)]
    );
    expect(res.rows[0].ordersOutstanding).toBe(1600);
    expect(res.rows[0].orderIds).toEqual(["o2"]);
  });

  it("an unlinked payment for an order's appointment counts as paid on that order", () => {
    const res = aggregateOutstandingBalances(
      [{ id: "o1", total: 500, createdAt: d("2026-09-01"), customerId: "c1", customer: cust("c1", "x"), payments: [], relatedEntityType: "Appointment", relatedEntityId: "a1" }],
      [],
      [{ customerId: "c1", amount: 500, appointmentId: "a1", boardingStayId: null }]
    );
    expect(res.rows).toEqual([]);
  });

  it("a payment for an appointment no order covers does not erase other debt", () => {
    const res = aggregateOutstandingBalances(
      [{ id: "o1", total: 500, createdAt: d("2026-09-01"), customerId: "c1", customer: cust("c1", "x"), payments: [] }],
      [],
      [{ customerId: "c1", amount: 500, appointmentId: "other-appt", boardingStayId: null }]
    );
    expect(res.grandTotal).toBe(500);
  });

  it("credit belongs to its own customer only and also covers pending payments", () => {
    const res = aggregateOutstandingBalances(
      [{ id: "o1", total: 300, createdAt: d("2026-09-01"), customerId: "c2", customer: cust("c2", "y"), payments: [] }],
      [{ id: "p1", amount: 100, createdAt: d("2026-09-02"), orderId: null, customerId: "c1", customer: cust("c1", "x") }],
      [{ customerId: "c1", amount: 60, appointmentId: null, boardingStayId: null }]
    );
    expect(res.rows.map((r) => [r.id, r.total])).toEqual([["c2", 300], ["c1", 40]]);
  });
});
