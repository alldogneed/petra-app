/**
 * Tests for lead deal value — input normalization, column sums, journal text
 * and the won-leads sales report (deal value + orders since closing).
 * Pure module, no Prisma mocks needed.
 */

import {
  normalizeDealValue,
  sumDealValues,
  describeDealValueChange,
  buildLeadSalesReport,
  MAX_DEAL_VALUE,
} from "@/lib/lead-deal-value";

describe("normalizeDealValue", () => {
  it("accepts a plain number", () => {
    expect(normalizeDealValue(350)).toEqual({ ok: true, value: 350 });
  });
  it("accepts numeric strings with ₪ and thousands separators", () => {
    expect(normalizeDealValue("₪1,200")).toEqual({ ok: true, value: 1200 });
    expect(normalizeDealValue(" 350.5 ")).toEqual({ ok: true, value: 350.5 });
  });
  it("accepts .5 and 350. but rejects malformed thousands separators", () => {
    expect(normalizeDealValue(".5")).toEqual({ ok: true, value: 0.5 });
    expect(normalizeDealValue("350.")).toEqual({ ok: true, value: 350 });
    expect(normalizeDealValue("1,2,3").ok).toBe(false);
    expect(normalizeDealValue("12,00").ok).toBe(false);
  });
  it("empty / null clears the value", () => {
    expect(normalizeDealValue("")).toEqual({ ok: true, value: null });
    expect(normalizeDealValue(null)).toEqual({ ok: true, value: null });
  });
  it("0 is a real value, not cleared", () => {
    expect(normalizeDealValue(0)).toEqual({ ok: true, value: 0 });
  });
  it("rounds to 2 decimals", () => {
    expect(normalizeDealValue(10.555)).toEqual({ ok: true, value: 10.56 });
  });
  it("rejects negatives, text, NaN and too-large values", () => {
    expect(normalizeDealValue(-1).ok).toBe(false);
    expect(normalizeDealValue("-5").ok).toBe(false);
    expect(normalizeDealValue("abc").ok).toBe(false);
    expect(normalizeDealValue(NaN).ok).toBe(false);
    expect(normalizeDealValue(MAX_DEAL_VALUE + 1).ok).toBe(false);
    expect(normalizeDealValue({}).ok).toBe(false);
  });
});

describe("sumDealValues", () => {
  it("treats missing values as 0", () => {
    expect(sumDealValues([{ dealValue: 350 }, { dealValue: null }, {}, { dealValue: 150.25 }])).toBe(500.25);
  });
  it("empty column → 0", () => {
    expect(sumDealValues([])).toBe(0);
  });
});

describe("describeDealValueChange", () => {
  it("set / cleared / changed", () => {
    expect(describeDealValueChange(null, 350)).toContain("נקבע");
    expect(describeDealValueChange(350, null)).toContain("הוסר");
    expect(describeDealValueChange(350, 500)).toContain("עודכן");
  });
});

describe("buildLeadSalesReport", () => {
  const d = (s: string) => new Date(s);

  it("adds orders placed after closing on the same customer", () => {
    const report = buildLeadSalesReport(
      [{ id: "l1", name: "דנה", wonAt: d("2026-09-01T10:00:00Z"), dealValue: 350, customerId: "c1" }],
      [
        { customerId: "c1", total: 200, status: "confirmed", createdAt: d("2026-09-05T10:00:00Z") },
        { customerId: "c1", total: 100, status: "draft", createdAt: d("2026-09-06T10:00:00Z") },
        { customerId: "c1", total: 999, status: "cancelled", createdAt: d("2026-09-07T10:00:00Z") },
        { customerId: "c1", total: 500, status: "completed", createdAt: d("2026-08-01T10:00:00Z") }, // before closing
        { customerId: "c2", total: 700, status: "completed", createdAt: d("2026-09-05T10:00:00Z") }, // other customer
      ],
    );
    expect(report.wonCount).toBe(1);
    expect(report.dealValueTotal).toBe(350);
    expect(report.ordersCount).toBe(2);
    expect(report.ordersTotal).toBe(300);
    expect(report.total).toBe(650);
    expect(report.rows[0]).toMatchObject({ leadId: "l1", ordersCount: 2, ordersTotal: 300, total: 650 });
  });

  it("never counts an order twice when the same customer closed twice", () => {
    const report = buildLeadSalesReport(
      [
        { id: "old", name: "א", wonAt: d("2026-01-01T00:00:00Z"), dealValue: 100, customerId: "c1" },
        { id: "new", name: "א", wonAt: d("2026-06-01T00:00:00Z"), dealValue: 200, customerId: "c1" },
      ],
      [
        { customerId: "c1", total: 50, status: "completed", createdAt: d("2026-03-01T00:00:00Z") },
        { customerId: "c1", total: 80, status: "completed", createdAt: d("2026-07-01T00:00:00Z") },
      ],
    );
    const byId = Object.fromEntries(report.rows.map((r) => [r.leadId, r]));
    expect(byId.old.ordersTotal).toBe(50);
    expect(byId.new.ordersTotal).toBe(80);
    expect(report.ordersTotal).toBe(130);
    expect(report.total).toBe(430);
  });

  it("an order owned by a later closing outside the period is not credited to the period lead", () => {
    const periodLead = { id: "jan", name: "א", wonAt: d("2026-01-10T00:00:00Z"), dealValue: 100, customerId: "c1" };
    const report = buildLeadSalesReport(
      [periodLead],
      [
        { customerId: "c1", total: 40, status: "completed", createdAt: d("2026-02-01T00:00:00Z") },
        { customerId: "c1", total: 90, status: "completed", createdAt: d("2026-07-01T00:00:00Z") },
      ],
      50,
      [periodLead, { id: "jun", wonAt: d("2026-06-01T00:00:00Z"), customerId: "c1" }],
    );
    expect(report.ordersTotal).toBe(40);
    expect(report.total).toBe(140);
  });

  it("won lead without value or customer still counts, avg ignores missing values", () => {
    const report = buildLeadSalesReport(
      [
        { id: "a", name: "א", wonAt: d("2026-09-01T00:00:00Z"), dealValue: 300, customerId: null },
        { id: "b", name: "ב", wonAt: d("2026-09-02T00:00:00Z"), dealValue: null, customerId: null },
      ],
      [],
    );
    expect(report.wonCount).toBe(2);
    expect(report.withValueCount).toBe(1);
    expect(report.avgDealValue).toBe(300);
    expect(report.rows.map((r) => r.leadId)).toEqual(["b", "a"]); // newest first
  });

  it("limits rows but totals cover all leads", () => {
    const leads = Array.from({ length: 5 }, (_, i) => ({
      id: `l${i}`, name: "x", wonAt: d(`2026-09-0${i + 1}T00:00:00Z`), dealValue: 10, customerId: null,
    }));
    const report = buildLeadSalesReport(leads, [], 2);
    expect(report.rows).toHaveLength(2);
    expect(report.dealValueTotal).toBe(50);
  });
});
