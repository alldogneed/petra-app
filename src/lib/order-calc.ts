/**
 * Order calculation library — tax, discounts, rounding.
 *
 * Assumptions / design decisions:
 * - Prices stored WITHOUT VAT (exclusive). VAT is added on top.
 * - If vatEnabled=false → taxTotal=0 for all lines.
 * - taxMode: "exempt" → 0 tax; "taxable" or "inherit" (inherit→taxable) → apply vatRate.
 * - Discount percent: applied proportionally to each line before tax.
 * - Discount fixed: allocated proportionally by line_subtotal across all lines.
 * - All monetary values rounded to 2 decimal places at each step.
 * - Order total = subtotal - discountAmount + taxTotal
 */

export interface CalcLineInput {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxMode: "inherit" | "taxable" | "exempt"; // snapshot value
}

export interface CalcLineResult {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;      // quantity * unitPrice (pre-discount, pre-tax)
  discountAllocation: number; // portion of order discount applied to this line
  taxableBase: number;        // lineSubtotal - discountAllocation (for taxable lines)
  lineTax: number;
  lineTotal: number;           // taxableBase + lineTax
  taxMode: string;
}

export interface CalcOrderInput {
  lines: CalcLineInput[];
  discountType: "none" | "percent" | "fixed";
  discountValue: number;  // percent 0-100 or fixed amount in ILS
  vatEnabled: boolean;
  vatRate: number;         // e.g. 0.17
}

export interface CalcOrderResult {
  lines: CalcLineResult[];
  subtotal: number;          // sum of lineSubtotals
  discountAmount: number;    // actual discount in ILS
  taxTotal: number;
  total: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcOrder(input: CalcOrderInput): CalcOrderResult {
  const { lines, discountType, discountValue, vatEnabled, vatRate } = input;

  if (lines.length === 0) {
    return { lines: [], subtotal: 0, discountAmount: 0, taxTotal: 0, total: 0 };
  }

  // 1. Compute per-line subtotals
  const withSubtotals = lines.map((l) => ({
    ...l,
    lineSubtotal: round2(l.quantity * l.unitPrice),
  }));

  const subtotal = round2(withSubtotals.reduce((s, l) => s + l.lineSubtotal, 0));

  // 2. Compute discount amount
  let discountAmount = 0;
  if (discountType === "percent") {
    discountAmount = round2(subtotal * Math.min(Math.max(discountValue, 0), 100) / 100);
  } else if (discountType === "fixed") {
    discountAmount = round2(Math.min(Math.max(discountValue, 0), subtotal));
  }

  // 3. Allocate discount proportionally across all lines
  //    (if subtotal==0, no allocation)
  const calcLines: CalcLineResult[] = withSubtotals.map((l) => {
    const alloc = subtotal > 0
      ? round2(discountAmount * (l.lineSubtotal / subtotal))
      : 0;

    const effectiveTaxMode = l.taxMode === "exempt" ? "exempt" : "taxable"; // inherit → taxable
    const taxableBase = round2(l.lineSubtotal - alloc);

    const lineTax = vatEnabled && effectiveTaxMode === "taxable"
      ? round2(taxableBase * vatRate)
      : 0;

    const lineTotal = round2(taxableBase + lineTax);

    return {
      name: l.name,
      unit: l.unit,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineSubtotal: l.lineSubtotal,
      discountAllocation: alloc,
      taxableBase,
      lineTax,
      lineTotal,
      taxMode: l.taxMode,
    };
  });

  // 4. Fix rounding drift on last line for discount
  //    (sum of allocations may differ by 1 cent from discountAmount)
  const allocSum = round2(calcLines.reduce((s, l) => s + l.discountAllocation, 0));
  const drift = round2(discountAmount - allocSum);
  if (drift !== 0 && calcLines.length > 0) {
    const last = calcLines[calcLines.length - 1];
    last.discountAllocation = round2(last.discountAllocation + drift);
    last.taxableBase = round2(last.lineSubtotal - last.discountAllocation);
    const effMode = last.taxMode === "exempt" ? "exempt" : "taxable";
    last.lineTax = vatEnabled && effMode === "taxable"
      ? round2(last.taxableBase * vatRate)
      : 0;
    last.lineTotal = round2(last.taxableBase + last.lineTax);
  }

  const taxTotal = round2(calcLines.reduce((s, l) => s + l.lineTax, 0));
  const total = round2(subtotal - discountAmount + taxTotal);

  return { lines: calcLines, subtotal, discountAmount, taxTotal, total };
}
