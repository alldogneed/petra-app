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
});
