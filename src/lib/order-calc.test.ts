/**
 * Unit tests for order-calc.ts
 * Covers: VAT logic, discount types, rounding, edge cases
 */

import { calcOrder, CalcOrderInput } from "./order-calc";

const BASE: Pick<CalcOrderInput, "vatEnabled" | "vatRate" | "discountType" | "discountValue"> = {
  vatEnabled: true,
  vatRate: 0.17,
  discountType: "none",
  discountValue: 0,
};

describe("calcOrder – empty input", () => {
  it("returns zeros for empty lines", () => {
    const result = calcOrder({ ...BASE, lines: [] });
    expect(result).toEqual({
      lines: [],
      subtotal: 0,
      discountAmount: 0,
      taxTotal: 0,
      total: 0,
    });
  });
});

describe("calcOrder – single line, no discount", () => {
  it("single taxable line: qty=1, price=100 → tax=17, total=117", () => {
    const result = calcOrder({
      ...BASE,
      lines: [{ name: "אילוף", unit: "per_session", quantity: 1, unitPrice: 100, taxMode: "taxable" }],
    });
    expect(result.subtotal).toBe(100);
    expect(result.discountAmount).toBe(0);
    expect(result.taxTotal).toBe(17);
    expect(result.total).toBe(117);
    expect(result.lines[0].lineSubtotal).toBe(100);
    expect(result.lines[0].lineTax).toBe(17);
    expect(result.lines[0].lineTotal).toBe(117);
  });

  it("single exempt line: qty=2, price=50 → tax=0, total=100", () => {
    const result = calcOrder({
      ...BASE,
      lines: [{ name: "פריט פטור", unit: "per_item", quantity: 2, unitPrice: 50, taxMode: "exempt" }],
    });
    expect(result.subtotal).toBe(100);
    expect(result.taxTotal).toBe(0);
    expect(result.total).toBe(100);
    expect(result.lines[0].lineTax).toBe(0);
  });

  it("inherit taxMode treated as taxable", () => {
    const result = calcOrder({
      ...BASE,
      lines: [{ name: "שירות", unit: "per_session", quantity: 1, unitPrice: 200, taxMode: "inherit" }],
    });
    expect(result.taxTotal).toBe(34); // 200 * 0.17
    expect(result.total).toBe(234);
  });

  it("vatEnabled=false → no tax regardless of taxMode", () => {
    const result = calcOrder({
      ...BASE,
      vatEnabled: false,
      lines: [{ name: "שירות", unit: "per_session", quantity: 1, unitPrice: 100, taxMode: "taxable" }],
    });
    expect(result.taxTotal).toBe(0);
    expect(result.total).toBe(100);
  });
});

describe("calcOrder – percent discount", () => {
  it("10% discount on 100₪ item → discount=10, tax on 90, total=90*1.17=105.3", () => {
    const result = calcOrder({
      ...BASE,
      discountType: "percent",
      discountValue: 10,
      lines: [{ name: "אילוף", unit: "per_session", quantity: 1, unitPrice: 100, taxMode: "taxable" }],
    });
    expect(result.subtotal).toBe(100);
    expect(result.discountAmount).toBe(10);
    expect(result.taxTotal).toBe(15.3);   // 90 * 0.17
    expect(result.total).toBe(105.3);     // 100 - 10 + 15.3
  });

  it("100% discount → discountAmount=subtotal, total=0, tax=0", () => {
    const result = calcOrder({
      ...BASE,
      discountType: "percent",
      discountValue: 100,
      lines: [{ name: "אילוף", unit: "per_session", quantity: 1, unitPrice: 250, taxMode: "taxable" }],
    });
    expect(result.discountAmount).toBe(250);
    expect(result.taxTotal).toBe(0);
    expect(result.total).toBe(0);
  });

  it("0% discount → no discount applied", () => {
    const result = calcOrder({
      ...BASE,
      discountType: "percent",
      discountValue: 0,
      lines: [{ name: "שירות", unit: "per_session", quantity: 1, unitPrice: 100, taxMode: "taxable" }],
    });
    expect(result.discountAmount).toBe(0);
    expect(result.total).toBe(117);
  });

  it("percent > 100 is clamped to 100", () => {
    const result = calcOrder({
      ...BASE,
      discountType: "percent",
      discountValue: 150,
      lines: [{ name: "שירות", unit: "per_session", quantity: 1, unitPrice: 100, taxMode: "taxable" }],
    });
    expect(result.discountAmount).toBe(100);
    expect(result.total).toBe(0);
  });
});

describe("calcOrder – fixed discount", () => {
  it("fixed 50₪ on 200₪ subtotal → discount=50, tax on 150", () => {
    const result = calcOrder({
      ...BASE,
      discountType: "fixed",
      discountValue: 50,
      lines: [{ name: "שירות", unit: "per_session", quantity: 1, unitPrice: 200, taxMode: "taxable" }],
    });
    expect(result.subtotal).toBe(200);
    expect(result.discountAmount).toBe(50);
    expect(result.taxTotal).toBe(25.5);  // 150 * 0.17
    expect(result.total).toBe(175.5);   // 200 - 50 + 25.5
  });

  it("fixed discount > subtotal is clamped to subtotal", () => {
    const result = calcOrder({
      ...BASE,
      discountType: "fixed",
      discountValue: 999,
      lines: [{ name: "שירות", unit: "per_session", quantity: 1, unitPrice: 100, taxMode: "taxable" }],
    });
    expect(result.discountAmount).toBe(100);
    expect(result.total).toBe(0);
  });

  it("fixed discount = 0 → no discount", () => {
    const result = calcOrder({
      ...BASE,
      discountType: "fixed",
      discountValue: 0,
      lines: [{ name: "שירות", unit: "per_session", quantity: 1, unitPrice: 100, taxMode: "taxable" }],
    });
    expect(result.discountAmount).toBe(0);
    expect(result.total).toBe(117);
  });
});

describe("calcOrder – multiple lines", () => {
  it("two taxable lines sum correctly", () => {
    const result = calcOrder({
      ...BASE,
      lines: [
        { name: "שירות א", unit: "per_session", quantity: 1, unitPrice: 100, taxMode: "taxable" },
        { name: "שירות ב", unit: "per_session", quantity: 2, unitPrice: 50, taxMode: "taxable" },
      ],
    });
    expect(result.subtotal).toBe(200);
    expect(result.taxTotal).toBe(34);   // 200 * 0.17
    expect(result.total).toBe(234);
  });

  it("mixed taxable + exempt lines", () => {
    const result = calcOrder({
      ...BASE,
      lines: [
        { name: "אילוף", unit: "per_session", quantity: 1, unitPrice: 100, taxMode: "taxable" },
        { name: "מוצר פטור", unit: "per_item", quantity: 1, unitPrice: 100, taxMode: "exempt" },
      ],
    });
    expect(result.subtotal).toBe(200);
    expect(result.taxTotal).toBe(17);  // only first line taxed: 100 * 0.17
    expect(result.total).toBe(217);   // 200 + 17
  });

  it("percent discount allocated proportionally across lines", () => {
    const result = calcOrder({
      ...BASE,
      discountType: "percent",
      discountValue: 10,
      lines: [
        { name: "ליינ 1", unit: "per_session", quantity: 1, unitPrice: 100, taxMode: "taxable" },
        { name: "ליינ 2", unit: "per_session", quantity: 1, unitPrice: 100, taxMode: "taxable" },
      ],
    });
    expect(result.subtotal).toBe(200);
    expect(result.discountAmount).toBe(20);
    // Each line gets 10 alloc → taxable base = 90 → tax = 15.3 each
    expect(result.taxTotal).toBe(30.6);
    expect(result.total).toBe(210.6); // 200 - 20 + 30.6
  });

  it("fixed discount allocated proportionally — rounding drift corrected on last line", () => {
    // 3 equal lines of 33.33 each → subtotal = 99.99
    // discount=10: each line gets 3.33... → allocations sum must equal 10 exactly
    const result = calcOrder({
      ...BASE,
      discountType: "fixed",
      discountValue: 10,
      lines: [
        { name: "א", unit: "per_item", quantity: 3, unitPrice: 33.33, taxMode: "taxable" },
        { name: "ב", unit: "per_item", quantity: 3, unitPrice: 33.33, taxMode: "taxable" },
        { name: "ג", unit: "per_item", quantity: 3, unitPrice: 33.33, taxMode: "taxable" },
      ],
    });
    const allocSum = result.lines.reduce((s, l) => s + l.discountAllocation, 0);
    expect(Math.round(allocSum * 100) / 100).toBe(result.discountAmount);
    // total should be: subtotal - discount + tax (no negative)
    expect(result.total).toBeGreaterThan(0);
    expect(result.total).toBe(
      Math.round((result.subtotal - result.discountAmount + result.taxTotal) * 100) / 100
    );
  });
});

describe("calcOrder – rounding precision", () => {
  it("price with many decimals is rounded to 2dp at line level", () => {
    const result = calcOrder({
      ...BASE,
      lines: [{ name: "שירות", unit: "per_session", quantity: 3, unitPrice: 33.333, taxMode: "taxable" }],
    });
    // lineSubtotal = round2(3 * 33.333) = round2(99.999) = 100
    expect(result.subtotal).toBe(100);
  });

  it("total = subtotal - discountAmount + taxTotal", () => {
    const result = calcOrder({
      ...BASE,
      discountType: "percent",
      discountValue: 15,
      lines: [{ name: "שירות", unit: "per_session", quantity: 7, unitPrice: 43.7, taxMode: "taxable" }],
    });
    const expected = Math.round((result.subtotal - result.discountAmount + result.taxTotal) * 100) / 100;
    expect(result.total).toBe(expected);
  });
});
