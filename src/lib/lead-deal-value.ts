/**
 * Lead deal value ("ערך עסקה") — a manual amount the business records on a lead.
 *
 * Kept separate from Order/Payment revenue: the deal value is never added into
 * "הכנסות". The sales report shows it side by side with the orders the customer
 * placed after the lead was won ("הזמנות מאז הסגירה").
 */

export const MAX_DEAL_VALUE = 10_000_000;

/** Order statuses that never count toward "הזמנות מאז הסגירה". */
export const EXCLUDED_ORDER_STATUSES = ["cancelled", "canceled"];

export type DealValueParse = { ok: true; value: number | null } | { ok: false; error: string };

/**
 * Normalize user/AI input. Accepts a number or a numeric string ("350", "₪1,200").
 * Empty string / null → null (cleared). Rounded to 2 decimals.
 */
export function normalizeDealValue(raw: unknown): DealValueParse {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  let n: number;
  if (typeof raw === "number") {
    n = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.replace(/[₪\s]/g, "");
    if (trimmed === "") return { ok: true, value: null };
    // Plain digits, or digits with proper thousands separators ("1,200"); optional decimals (".5", "350.")
    if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d*)?$|^\.\d+$/.test(trimmed)) return { ok: false, error: "ערך עסקה חייב להיות מספר" };
    n = Number(trimmed.replace(/,/g, ""));
  } else {
    return { ok: false, error: "ערך עסקה חייב להיות מספר" };
  }
  if (!Number.isFinite(n)) return { ok: false, error: "ערך עסקה חייב להיות מספר" };
  if (n < 0) return { ok: false, error: "ערך עסקה לא יכול להיות שלילי" };
  if (n > MAX_DEAL_VALUE) return { ok: false, error: "ערך עסקה גבוה מדי" };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

export function formatIls(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Sum of deal values; leads without a value count as 0. */
export function sumDealValues(leads: { dealValue?: number | null }[]): number {
  let sum = 0;
  for (const l of leads) sum += l.dealValue ?? 0;
  return Math.round(sum * 100) / 100;
}

/** Journal line written to CallLog when the value changes. */
export function describeDealValueChange(from: number | null, to: number | null): string {
  if (from === null && to !== null) return `ערך עסקה נקבע: ${formatIls(to)}`;
  if (from !== null && to === null) return `ערך עסקה הוסר (היה ${formatIls(from)})`;
  return `ערך עסקה עודכן מ-${formatIls(from ?? 0)} ל-${formatIls(to ?? 0)}`;
}

// ── Sales report ─────────────────────────────────────────────────────────────

export interface WonLeadInput {
  id: string;
  name: string;
  wonAt: Date;
  dealValue: number | null;
  customerId: string | null;
}

export interface CustomerOrderInput {
  customerId: string;
  total: number;
  status: string;
  createdAt: Date;
}

export interface LeadSalesRow {
  leadId: string;
  name: string;
  customerId: string | null;
  wonAt: string;
  dealValue: number | null;
  ordersCount: number;
  ordersTotal: number;
  total: number;
}

export interface LeadSalesReport {
  wonCount: number;
  withValueCount: number;
  dealValueTotal: number;
  avgDealValue: number;
  ordersCount: number;
  ordersTotal: number;
  total: number;
  rows: LeadSalesRow[];
}

export const LEAD_SALES_ROWS_LIMIT = 50;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Won leads + the orders their customers placed from the moment of closing.
 * An order is attributed to the customer's most recent won lead at or before the
 * order date, so a customer who closed twice never has an order counted twice.
 *
 * `ownerLeads` = every won lead of those customers (any date). Ownership is decided
 * over that full list, so an order that belongs to a later closing (outside the
 * report period) is not credited to an earlier lead inside the period.
 * Defaults to `wonLeads`.
 */
export function buildLeadSalesReport(
  wonLeads: WonLeadInput[],
  orders: CustomerOrderInput[],
  rowsLimit = LEAD_SALES_ROWS_LIMIT,
  ownerLeads: Pick<WonLeadInput, "id" | "wonAt" | "customerId">[] = wonLeads,
): LeadSalesReport {
  const rows = new Map<string, LeadSalesRow>();
  const leadsByCustomer = new Map<string, Pick<WonLeadInput, "id" | "wonAt" | "customerId">[]>();

  for (const l of wonLeads) {
    rows.set(l.id, {
      leadId: l.id,
      name: l.name,
      customerId: l.customerId,
      wonAt: l.wonAt.toISOString(),
      dealValue: l.dealValue,
      ordersCount: 0,
      ordersTotal: 0,
      total: l.dealValue ?? 0,
    });
  }
  const seenOwners = new Set<string>();
  for (const l of [...ownerLeads, ...wonLeads]) {
    if (!l.customerId || seenOwners.has(l.id)) continue;
    seenOwners.add(l.id);
    const list = leadsByCustomer.get(l.customerId) ?? [];
    list.push(l);
    leadsByCustomer.set(l.customerId, list);
  }
  leadsByCustomer.forEach((list) => list.sort((a, b) => b.wonAt.getTime() - a.wonAt.getTime()));

  for (const o of orders) {
    if (EXCLUDED_ORDER_STATUSES.includes(o.status)) continue;
    const candidates = leadsByCustomer.get(o.customerId);
    if (!candidates) continue;
    const owner = candidates.find((l) => l.wonAt.getTime() <= o.createdAt.getTime());
    if (!owner) continue;
    const row = rows.get(owner.id);
    if (!row) continue; // owned by a closing outside this report
    row.ordersCount += 1;
    row.ordersTotal = round2(row.ordersTotal + (o.total || 0));
    row.total = round2((row.dealValue ?? 0) + row.ordersTotal);
  }

  const all = Array.from(rows.values());
  const withValue = all.filter((r) => r.dealValue !== null);
  const dealValueTotal = round2(withValue.reduce((s, r) => s + (r.dealValue ?? 0), 0));
  const ordersTotal = round2(all.reduce((s, r) => s + r.ordersTotal, 0));

  return {
    wonCount: all.length,
    withValueCount: withValue.length,
    dealValueTotal,
    avgDealValue: withValue.length > 0 ? Math.round(dealValueTotal / withValue.length) : 0,
    ordersCount: all.reduce((s, r) => s + r.ordersCount, 0),
    ordersTotal,
    total: round2(dealValueTotal + ordersTotal),
    rows: all
      .sort((a, b) => new Date(b.wonAt).getTime() - new Date(a.wonAt).getTime())
      .slice(0, rowsLimit),
  };
}
