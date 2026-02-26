/**
 * Order calculation library — tax, discounts, rounding.
 *
 * Assumptions / design decisions:
 * - Prices are VAT-INCLUSIVE (gross). VAT is extracted from the price.
 * - If vatEnabled=false → taxTotal=0, total = subtotal - discount.
 * - taxMode: "exempt" → 0 tax; "taxable" or "inherit" (inherit→taxable) → extract vatRate.
 * - Discount percent: applied proportionally to each line (on gross amount).
 * - Discount fixed: allocated proportionally by line_subtotal across all lines.
 * - All monetary values rounded to 2 decimal places at each step.
 * - Order total = subtotal - discountAmount (tax is already included in subtotal)
 */

export interface CalcLineInput {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;         // VAT-inclusive price
  taxMode: "inherit" | "taxable" | "exempt"; // snapshot value
}

export interface CalcLineResult {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;      // quantity * unitPrice (gross, VAT-inclusive)
  discountAllocation: number; // portion of order discount applied to this line
  taxableBase: number;        // net amount (after extracting VAT and discount)
  lineTax: number;            // VAT extracted from the gross price
  lineTotal: number;          // gross after discount (= taxableBase + lineTax)
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
  subtotal: number;          // sum of lineSubtotals (gross, VAT-inclusive)
  discountAmount: number;    // actual discount in ILS
  taxTotal: number;          // total VAT extracted
  total: number;             // subtotal - discountAmount
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcOrder(input: CalcOrderInput): CalcOrderResult {
  const { lines, discountType, discountValue, vatEnabled, vatRate } = input;

  if (lines.length === 0) {
    return { lines: [], subtotal: 0, discountAmount: 0, taxTotal: 0, total: 0 };
  }

  // 1. Compute per-line subtotals (gross, VAT-inclusive)
  const withSubtotals = lines.map((l) => ({
    ...l,
    lineSubtotal: round2(l.quantity * l.unitPrice),
  }));

  const subtotal = round2(withSubtotals.reduce((s, l) => s + l.lineSubtotal, 0));

  // 2. Compute discount amount (applied on gross)
  let discountAmount = 0;
  if (discountType === "percent") {
    discountAmount = round2(subtotal * Math.min(Math.max(discountValue, 0), 100) / 100);
  } else if (discountType === "fixed") {
    discountAmount = round2(Math.min(Math.max(discountValue, 0), subtotal));
  }

  // 3. Allocate discount proportionally and extract VAT from gross
  const calcLines: CalcLineResult[] = withSubtotals.map((l) => {
    const alloc = subtotal > 0
      ? round2(discountAmount * (l.lineSubtotal / subtotal))
      : 0;

    const effectiveTaxMode = l.taxMode === "exempt" ? "exempt" : "taxable";
    const grossAfterDiscount = round2(l.lineSubtotal - alloc);

    // Extract VAT from gross: net = gross / (1 + vatRate), tax = gross - net
    const lineTax = vatEnabled && effectiveTaxMode === "taxable"
      ? round2(grossAfterDiscount - grossAfterDiscount / (1 + vatRate))
      : 0;

    const taxableBase = round2(grossAfterDiscount - lineTax);
    const lineTotal = grossAfterDiscount;

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
  const allocSum = round2(calcLines.reduce((s, l) => s + l.discountAllocation, 0));
  const drift = round2(discountAmount - allocSum);
  if (drift !== 0 && calcLines.length > 0) {
    const last = calcLines[calcLines.length - 1];
    last.discountAllocation = round2(last.discountAllocation + drift);
    const grossAfterDiscount = round2(last.lineSubtotal - last.discountAllocation);
    const effMode = last.taxMode === "exempt" ? "exempt" : "taxable";
    last.lineTax = vatEnabled && effMode === "taxable"
      ? round2(grossAfterDiscount - grossAfterDiscount / (1 + vatRate))
      : 0;
    last.taxableBase = round2(grossAfterDiscount - last.lineTax);
    last.lineTotal = grossAfterDiscount;
  }

  const taxTotal = round2(calcLines.reduce((s, l) => s + l.lineTax, 0));
  const total = round2(subtotal - discountAmount);

  return { lines: calcLines, subtotal, discountAmount, taxTotal, total };
}
