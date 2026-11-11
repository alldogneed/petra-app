/**
 * Unit tests for order-calc.ts
 * Covers: VAT logic, discount types, rounding, edge cases
 *
 * Prices are VAT-INCLUSIVE (gross) — see the header of order-calc.ts and the
 * "כולל מע״מ" label in CreateOrderModal. VAT is extracted, never added:
 *   lineTax = round2(gross - gross / (1 + vatRate)), total = subtotal - discount.
 * With 18%: 100 → tax 15.25 (net 84.75), 200 → 30.51, 90 → 13.73, 150 → 22.88.
 */

import { calcOrder, CalcOrderInput } from "./order-calc";

const BASE: Pick<CalcOrderInput, "vatEnabled" | "vatRate" | "discountType" | "discountValue"> = {
  vatEnabled: true,
  vatRate: 0.18, // Israeli VAT since 1.1.2025 (VAT_RATE in constants.ts)
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
  it("single taxable line: qty=1, price=100 (incl. VAT) → tax=15.25, total=100", () => {
    const result = calcOrder({
      ...BASE,
      lines: [{ name: "אילוף", unit: "per_session", quantity: 1, unitPrice: 100, taxMode: "taxable" }],
    });
    expect(result.subtotal).toBe(100);
    expect(result.discountAmount).toBe(0);
    expect(result.taxTotal).toBe(15.25);  // 100 - 100/1.18
    expect(result.total).toBe(100);       // VAT already inside the price
    expect(result.lines[0].lineSubtotal).toBe(100);
    expect(result.lines[0].lineTax).toBe(15.25);
    expect(result.lines[0].taxableBase).toBe(84.75);
    expect(result.lines[0].lineTotal).toBe(100);
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
    expect(result.taxTotal).toBe(30.51); // 200 - 200/1.18
    expect(result.total).toBe(200);
    expect(result.lines[0].taxableBase).toBe(169.49);
  });

  it("vatEnabled=false → no tax regardless of taxMode", () => {
    const result = calcOrder({
      ...BASE,
      vatEnabled: false,
      lines: [{ name: "שירות", unit: "per_session", quantity: 1, unitPrice: 100, taxMode: "taxable" }],
    });
    expect(result.taxTotal).toBe(0);
    expect(result.total).toBe(100);
    expect(result.lines[0].taxableBase).toBe(100);
  });
});

describe("calcOrder – percent discount", () => {
  it("10% discount on 100₪ item → discount=10, VAT extracted from 90, total=90", () => {
    const result = calcOrder({
      ...BASE,
      discountType: "percent",
      discountValue: 10,
      lines: [{ name: "אילוף", unit: "per_session", quantity: 1, unitPrice: 100, taxMode: "taxable" }],
    });
    expect(result.subtotal).toBe(100);
    expect(result.discountAmount).toBe(10);
    expect(result.taxTotal).toBe(13.73);  // 90 - 90/1.18
    expect(result.total).toBe(90);        // 100 - 10
    expect(result.lines[0].discountAllocation).toBe(10);
    expect(result.lines[0].lineTotal).toBe(90);
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
    expect(result.taxTotal).toBe(15.25);
    expect(result.total).toBe(100);
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
  it("fixed 50₪ on 200₪ subtotal → discount=50, VAT extracted from 150", () => {
    const result = calcOrder({
      ...BASE,
      discountType: "fixed",
      discountValue: 50,
      lines: [{ name: "שירות", unit: "per_session", quantity: 1, unitPrice: 200, taxMode: "taxable" }],
    });
    expect(result.subtotal).toBe(200);
    expect(result.discountAmount).toBe(50);
    expect(result.taxTotal).toBe(22.88); // 150 - 150/1.18
    expect(result.total).toBe(150);      // 200 - 50
    expect(result.lines[0].taxableBase).toBe(127.12);
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
    expect(result.taxTotal).toBe(15.25);
    expect(result.total).toBe(100);
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
    expect(result.taxTotal).toBe(30.5);  // per line: 15.25 + 15.25 (rounded per line)
    expect(result.total).toBe(200);
    expect(result.lines.map((l) => l.lineTax)).toEqual([15.25, 15.25]);
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
    expect(result.taxTotal).toBe(15.25); // only the first line carries VAT
    expect(result.total).toBe(200);
    expect(result.lines[1].lineTax).toBe(0);
    expect(result.lines[1].taxableBase).toBe(100);
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
    // Each line gets 10 alloc → gross 90 → tax = 13.73 each
    expect(result.lines.map((l) => l.discountAllocation)).toEqual([10, 10]);
    expect(result.taxTotal).toBe(27.46);
    expect(result.total).toBe(180); // 200 - 20
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
    expect(result.subtotal).toBe(299.97);
    expect(result.discountAmount).toBe(10);
    // round2(10/3) = 3.33 per line → sum 9.99 → the 0.01 drift lands on the last line
    expect(result.lines.map((l) => l.discountAllocation)).toEqual([3.33, 3.33, 3.34]);
    const allocSum = result.lines.reduce((s, l) => s + l.discountAllocation, 0);
    expect(Math.round(allocSum * 100) / 100).toBe(result.discountAmount);
    // The last line's VAT is recomputed from its corrected gross
    const last = result.lines[2];
    expect(last.lineTotal).toBe(96.65); // 99.99 - 3.34
    expect(last.lineTax).toBe(Math.round((96.65 - 96.65 / 1.18) * 100) / 100);
    // total = subtotal - discount (VAT is inside the gross, no negative)
    expect(result.total).toBeGreaterThan(0);
    expect(result.total).toBe(
      Math.round((result.subtotal - result.discountAmount) * 100) / 100
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

  it("total = subtotal - discountAmount; taxTotal = sum of line VAT", () => {
    const result = calcOrder({
      ...BASE,
      discountType: "percent",
      discountValue: 15,
      lines: [{ name: "שירות", unit: "per_session", quantity: 7, unitPrice: 43.7, taxMode: "taxable" }],
    });
    // 7 * 43.7 = 305.9, 15% = 45.89 (round2(45.885)), gross 260.01
    expect(result.subtotal).toBe(305.9);
    expect(result.discountAmount).toBe(45.89);
    const expected = Math.round((result.subtotal - result.discountAmount) * 100) / 100;
    expect(result.total).toBe(expected);
    const lineTaxSum = Math.round(result.lines.reduce((s, l) => s + l.lineTax, 0) * 100) / 100;
    expect(result.taxTotal).toBe(lineTaxSum);
    expect(result.lines[0].taxableBase + result.lines[0].lineTax).toBeCloseTo(result.lines[0].lineTotal, 2);
  });
});
