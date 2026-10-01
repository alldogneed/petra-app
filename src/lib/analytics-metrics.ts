/**
 * Pure computations behind /analytics (getAnalytics in src/services/business.ts) and the
 * Excel export (/api/analytics/export). No Prisma here — everything is unit-tested in
 * src/lib/__tests__/analytics-metrics.test.ts.
 *
 * Appointment.date storage: a calendar day (UTC midnight of YYYY-MM-DD from `new Date("YYYY-MM-DD")`;
 * the online-booking routes write server-local midnight, which is also UTC on Vercel).
 * `israelYmdOf()` maps both UTC midnight and Israel midnight to the intended calendar day, so the
 * day of an appointment is always derived through it — never `getDay()` on the server.
 */
import type { RevenueCategory } from "@/lib/analytics-types";
import { PAYMENT_METHODS } from "@/lib/constants";
import { isYmd, israelDayEnd, israelDayStart, israelDayOfWeek, israelYmdOf, pct } from "@/lib/report-dates";

const DAY_MS = 86_400_000;

// ─── Status sets (case / spelling variants found in the codebase) ────────────

export const APPOINTMENT_COMPLETED_STATUSES = ["completed", "COMPLETED"];
export const APPOINTMENT_CANCELED_STATUSES = ["canceled", "cancelled", "CANCELED", "CANCELLED"];
export const APPOINTMENT_NO_SHOW_STATUSES = ["no_show", "NO_SHOW"];
/** BoardingStay statuses: reserved / checked_in / checked_out / canceled. */
export const BOARDING_CANCELED_STATUSES = ["canceled", "cancelled"];

export const isCompletedStatus = (s: string) => APPOINTMENT_COMPLETED_STATUSES.includes(s);
export const isCanceledStatus = (s: string) => APPOINTMENT_CANCELED_STATUSES.includes(s);
export const isNoShowStatus = (s: string) => APPOINTMENT_NO_SHOW_STATUSES.includes(s);

// ─── Labels ──────────────────────────────────────────────────────────────────

export const DAY_LABELS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export const REVENUE_CATEGORY_LABELS: Record<RevenueCategory, string> = {
  appointments: "תורים",
  boarding: "פנסיון",
  orders: "הזמנות ומוצרים",
  training: "אילוף",
  other: "אחר",
};
const REVENUE_CATEGORY_ORDER: RevenueCategory[] = ["appointments", "boarding", "training", "orders", "other"];

/** Order.orderType → Hebrew (same labels as /api/orders/export). */
export const ORDER_TYPE_LABELS_HE: Record<string, string> = {
  sale: "מוצרים",
  products: "מוצרים",
  appointment: "תור",
  training: "אילוף",
  boarding: "פנסיון",
  grooming: "טיפוח",
  service_dog: "כלבי שירות",
};

/** Payment.method → Hebrew (PAYMENT_METHODS in constants + "check", which the payment routes also accept). */
export const PAYMENT_METHOD_LABELS_HE: Record<string, string> = {
  ...Object.fromEntries(PAYMENT_METHODS.map((m) => [m.id, m.label])),
  check: "צ׳ק",
};

// ─── Range ───────────────────────────────────────────────────────────────────

export interface AnalyticsRange {
  period: string;
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  /** True when a valid custom from/to was used. */
  custom: boolean;
}

const PRESET_DAYS: Record<string, number> = { week: 7, month: 30, quarter: 90, year: 365 };

/**
 * Custom range: `from`/`to` as Israel "YYYY-MM-DD" → israelDayStart(from)…israelDayEnd(to)
 * (swapped when reversed). Invalid/missing → preset rolling window ending `now`
 * (week=7d, month=30d, quarter=90d, year=365d; unknown period → month).
 * Previous period = the equal-length window right before `from`.
 */
export function resolveAnalyticsRange(
  period: string | undefined,
  fromParam: string | null | undefined,
  toParam: string | null | undefined,
  now: Date = new Date()
): AnalyticsRange {
  let from: Date;
  let to: Date;
  let custom = false;
  let p = period && PRESET_DAYS[period] ? period : "month";
  if (isYmd(fromParam) && isYmd(toParam)) {
    const [a, b] = fromParam <= toParam ? [fromParam, toParam] : [toParam, fromParam];
    from = israelDayStart(a);
    to = israelDayEnd(b);
    custom = true;
    p = period || "custom";
  } else {
    to = now;
    from = new Date(now.getTime() - PRESET_DAYS[p] * DAY_MS);
  }
  const len = to.getTime() - from.getTime();
  return { period: p, from, to, prevFrom: new Date(from.getTime() - len), prevTo: from, custom };
}

// ─── Appointments ────────────────────────────────────────────────────────────

export interface AppointmentLite {
  date: Date;
  startTime: string;
  endTime?: string | null;
  status: string;
}

/** Israel-local "HH:MM" of an instant. */
export function israelHm(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Has the appointment (day + end time, Israel) already happened at `now`? */
export function isAppointmentPast(a: AppointmentLite, now: Date): boolean {
  const day = israelYmdOf(a.date);
  const today = israelYmdOf(now);
  if (day !== today) return day < today;
  const end = (a.endTime || a.startTime || "").slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(end)) return false;
  return end <= israelHm(now);
}

export interface AppointmentStats {
  total: number;
  completed: number;
  canceled: number;
  noShow: number;
  /** Non-canceled appointments that already happened (or were already marked completed). */
  due: number;
  /** completed / due — future scheduled appointments don't drag it down. 0 when nothing is due. */
  completionRate: number;
  /** canceled / total. */
  cancellationRate: number | null;
  /** no-show / due. */
  noShowRate: number | null;
}

export function computeAppointmentStats(appts: AppointmentLite[], now: Date): AppointmentStats {
  let completed = 0;
  let canceled = 0;
  let noShow = 0;
  let due = 0;
  for (const a of appts) {
    if (isCanceledStatus(a.status)) {
      canceled++;
      continue;
    }
    const isDone = isCompletedStatus(a.status);
    if (isDone) completed++;
    if (isNoShowStatus(a.status)) noShow++;
    if (isDone || isAppointmentPast(a, now)) due++;
  }
  return {
    total: appts.length,
    completed,
    canceled,
    noShow,
    due,
    completionRate: pct(completed, due) ?? 0,
    cancellationRate: pct(canceled, appts.length),
    noShowRate: pct(noShow, due),
  };
}

/** Day-of-week (Israel, 0 = ראשון) + hour histograms + per-day counts. Canceled excluded from DOW/hour. */
export function buildAppointmentCharts(appts: AppointmentLite[]) {
  const byDayOfWeek = DAY_LABELS_HE.map((day) => ({ day, count: 0 }));
  const byHour = new Map<number, number>();
  const byDate = new Map<string, number>();
  for (const a of appts) {
    const ymd = israelYmdOf(a.date);
    byDate.set(ymd, (byDate.get(ymd) ?? 0) + 1);
    if (isCanceledStatus(a.status)) continue;
    byDayOfWeek[israelDayOfWeek(a.date)].count++;
    const hour = parseInt((a.startTime || "").split(":")[0], 10);
    if (!Number.isNaN(hour) && hour >= 0 && hour < 24) byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  }
  return {
    appointmentsByDate: Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
    appointmentsByDayOfWeek: byDayOfWeek,
    appointmentsByHour: Array.from(byHour.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, count]) => ({ hour, label: `${hour}:00`, count })),
  };
}

// ─── Revenue ─────────────────────────────────────────────────────────────────

export interface PaymentLite {
  amount: number;
  method?: string | null;
  customerId: string;
  appointmentId?: string | null;
  boardingStayId?: string | null;
  orderId?: string | null;
  appointment?: { service?: { name: string } | null; priceListItem?: { name: string } | null } | null;
  order?: { orderType?: string | null } | null;
}

/**
 * Category + display name of a paid payment. Link precedence: appointment → boarding stay → order.
 * Payment has no direct training link; training is sold through orders (orderType "training").
 */
export function classifyPayment(p: PaymentLite): { category: RevenueCategory; name: string } {
  if (p.appointmentId) {
    return {
      category: "appointments",
      name: p.appointment?.service?.name || p.appointment?.priceListItem?.name || "תור",
    };
  }
  if (p.boardingStayId) return { category: "boarding", name: "פנסיון" };
  if (p.orderId) {
    const t = p.order?.orderType ?? "";
    const category: RevenueCategory = t === "training" ? "training" : t === "boarding" ? "boarding" : "orders";
    return { category, name: ORDER_TYPE_LABELS_HE[t] ?? "הזמנות" };
  }
  return { category: "other", name: "אחר" };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Revenue split by category and by display name. Σ byCategory === Σ byName === Σ amounts
 * (byName keeps the top `maxNames - 1` names and folds the rest into "אחר").
 */
export function buildRevenueBreakdown(payments: PaymentLite[], maxNames = 8) {
  const byCat = new Map<RevenueCategory, number>();
  const byName = new Map<string, number>();
  let total = 0;
  for (const p of payments) {
    const { category, name } = classifyPayment(p);
    byCat.set(category, (byCat.get(category) ?? 0) + p.amount);
    byName.set(name, (byName.get(name) ?? 0) + p.amount);
    total += p.amount;
  }
  const byCategory = REVENUE_CATEGORY_ORDER.filter((c) => byCat.has(c)).map((category) => ({
    category,
    label: REVENUE_CATEGORY_LABELS[category],
    revenue: round2(byCat.get(category) ?? 0),
  }));

  const sorted = Array.from(byName.entries()).sort((a, b) => b[1] - a[1]);
  let named = sorted;
  if (sorted.length > maxNames) {
    const head = sorted.filter(([n]) => n !== "אחר").slice(0, maxNames - 1);
    const headNames = new Set(head.map(([n]) => n));
    const rest = sorted.filter(([n]) => !headNames.has(n)).reduce((s, [, v]) => s + v, 0);
    named = [...head, ["אחר", rest]];
  }
  const revenueByService = named.map(([name, revenue]) => ({ name, revenue: round2(revenue) }));
  return { total: round2(total), byCategory, revenueByService };
}

export function buildRevenueByMethod(payments: { amount: number; method?: string | null }[]) {
  const map = new Map<string, { revenue: number; count: number }>();
  for (const p of payments) {
    const method = p.method || "other";
    const r = map.get(method) ?? { revenue: 0, count: 0 };
    r.revenue += p.amount;
    r.count++;
    map.set(method, r);
  }
  return Array.from(map.entries())
    .map(([method, r]) => ({ method, label: PAYMENT_METHOD_LABELS_HE[method] ?? method, revenue: round2(r.revenue), count: r.count }))
    .sort((a, b) => b.revenue - a.revenue);
}

/** Last-12-months revenue (+ same month a year earlier) from paid payments bucketed by Israel month. */
export function buildMonthlyRevenue(
  payments: { amount: number; paidAt: Date | null }[],
  monthKeys: string[],
  prevYearKey: (k: string) => string
) {
  const byMonth = new Map<string, number>();
  for (const p of payments) {
    if (!p.paidAt) continue;
    const k = israelYmdOf(p.paidAt).slice(0, 7);
    byMonth.set(k, (byMonth.get(k) ?? 0) + p.amount);
  }
  return monthKeys.map((month) => ({
    month,
    revenue: round2(byMonth.get(month) ?? 0),
    prevYearRevenue: round2(byMonth.get(prevYearKey(month)) ?? 0),
  }));
}

// ─── Customers ───────────────────────────────────────────────────────────────

/**
 * Retention: base = customers active in the PREVIOUS period; returning = those also active now.
 * "Active" = ≥1 completed appointment or paid payment (callers pass the id sets).
 */
export function computeRetention(prevActive: Iterable<string>, currentActive: Iterable<string>) {
  const base = new Set(prevActive);
  const current = new Set(currentActive);
  let returning = 0;
  base.forEach((id) => {
    if (current.has(id)) returning++;
  });
  return { returningCustomers: returning, customersWithAppointments: base.size, retentionRate: pct(returning, base.size) };
}

/** revenue / distinct paying customers (null when nobody paid). */
export function avgRevenuePerPayingCustomer(revenue: number, payingCustomers: number): number | null {
  return payingCustomers > 0 ? round2(revenue / payingCustomers) : null;
}

/** Revenue split by whether the paying customer was created inside [from, to]. */
export function splitNewVsReturning(
  payments: { amount: number; customerCreatedAt: Date | null }[],
  from: Date,
  to: Date
) {
  let newCustomers = 0;
  let returningCustomers = 0;
  for (const p of payments) {
    const c = p.customerCreatedAt;
    if (c && c >= from && c <= to) newCustomers += p.amount;
    else returningCustomers += p.amount;
  }
  return { newCustomers: round2(newCustomers), returningCustomers: round2(returningCustomers) };
}

// ─── Boarding ────────────────────────────────────────────────────────────────

export interface StayLite {
  checkIn: Date;
  checkOut: Date | null;
  roomId: string | null;
}

/**
 * Room-night occupancy over [from, to]. Each stay = one dog = one occupied place
 * (a capacity-2 room holding one dog is 1 of 2). Stays are clipped to the period; an open-ended
 * stay runs until min(now, to). Only stays in a counted room (active rooms) occupy capacity.
 */
export function computeOccupancy(
  stays: StayLite[],
  rooms: { id: string; capacity: number }[],
  from: Date,
  to: Date,
  now: Date
) {
  const roomIds = new Set(rooms.map((r) => r.id));
  const periodDays = Math.max(0, (to.getTime() - from.getTime()) / DAY_MS);
  const capacityNights = Math.round(rooms.reduce((s, r) => s + Math.max(0, r.capacity), 0) * periodDays);
  let occupiedMs = 0;
  for (const s of stays) {
    if (!s.roomId || !roomIds.has(s.roomId)) continue;
    const end = s.checkOut ?? (now < to ? now : to);
    const a = Math.max(s.checkIn.getTime(), from.getTime());
    const b = Math.min(end.getTime(), to.getTime());
    if (b > a) occupiedMs += b - a;
  }
  const occupiedNights = Math.round(occupiedMs / DAY_MS);
  return { occupiedNights, capacityNights, occupancyRate: pct(occupiedNights, capacityNights) };
}
