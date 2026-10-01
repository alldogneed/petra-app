import {
  avgRevenuePerPayingCustomer,
  buildAppointmentCharts,
  buildMonthlyRevenue,
  buildRevenueBreakdown,
  buildRevenueByMethod,
  classifyPayment,
  computeAppointmentStats,
  computeOccupancy,
  computeRetention,
  isAppointmentPast,
  resolveAnalyticsRange,
  splitNewVsReturning,
  type PaymentLite,
} from "@/lib/analytics-metrics";
import { israelDayEnd, israelDayStart, prevYearMonthKey } from "@/lib/report-dates";

const DAY = 86_400_000;
const d = (iso: string) => new Date(iso);

describe("resolveAnalyticsRange", () => {
  const now = d("2026-10-01T09:00:00Z");
  it("custom YMD range uses Israel day bounds", () => {
    const r = resolveAnalyticsRange("month", "2026-09-01", "2026-09-30", now);
    expect(r.custom).toBe(true);
    expect(r.from.toISOString()).toBe(israelDayStart("2026-09-01").toISOString());
    expect(r.to.toISOString()).toBe(israelDayEnd("2026-09-30").toISOString());
    expect(r.from.toISOString()).toBe("2026-08-31T21:00:00.000Z");
    expect(r.prevTo.getTime()).toBe(r.from.getTime());
    expect(r.from.getTime() - r.prevFrom.getTime()).toBe(r.to.getTime() - r.from.getTime());
  });
  it("swaps reversed custom range", () => {
    const r = resolveAnalyticsRange("month", "2026-09-30", "2026-09-01", now);
    expect(r.from < r.to).toBe(true);
  });
  it("invalid custom → preset rolling window ending now", () => {
    const r = resolveAnalyticsRange("week", "2026-13-01", "nope", now);
    expect(r.custom).toBe(false);
    expect(r.to.getTime()).toBe(now.getTime());
    expect(now.getTime() - r.from.getTime()).toBe(7 * DAY);
  });
  it("presets: quarter=90, year=365, unknown → month (30)", () => {
    expect(now.getTime() - resolveAnalyticsRange("quarter", null, null, now).from.getTime()).toBe(90 * DAY);
    expect(now.getTime() - resolveAnalyticsRange("year", null, null, now).from.getTime()).toBe(365 * DAY);
    const r = resolveAnalyticsRange("bogus", null, null, now);
    expect(r.period).toBe("month");
    expect(now.getTime() - r.from.getTime()).toBe(30 * DAY);
  });
});

describe("appointments", () => {
  // now = 2026-10-01 12:00 Israel (09:00Z, IDT +3)
  const now = d("2026-10-01T09:00:00Z");
  const appt = (date: string, status: string, startTime = "10:00", endTime = "11:00") => ({
    date: d(`${date}T00:00:00Z`),
    startTime,
    endTime,
    status,
  });

  it("isAppointmentPast uses day + end time in Israel", () => {
    expect(isAppointmentPast(appt("2026-09-30", "scheduled"), now)).toBe(true);
    expect(isAppointmentPast(appt("2026-10-02", "scheduled"), now)).toBe(false);
    expect(isAppointmentPast(appt("2026-10-01", "scheduled", "10:00", "11:00"), now)).toBe(true);
    expect(isAppointmentPast(appt("2026-10-01", "scheduled", "12:30", "13:00"), now)).toBe(false);
  });

  it("completion rate ignores future scheduled appointments", () => {
    const stats = computeAppointmentStats(
      [
        appt("2026-09-20", "completed"),
        appt("2026-09-21", "COMPLETED"),
        appt("2026-09-22", "no_show"),
        appt("2026-09-23", "canceled"),
        appt("2026-09-24", "cancelled"),
        appt("2026-09-25", "scheduled"), // past, never closed → counts against
        appt("2026-10-05", "scheduled"), // future → ignored
        appt("2026-10-06", "scheduled"), // future → ignored
      ],
      now
    );
    expect(stats.total).toBe(8);
    expect(stats.completed).toBe(2);
    expect(stats.canceled).toBe(2);
    expect(stats.noShow).toBe(1);
    expect(stats.due).toBe(4);
    expect(stats.completionRate).toBe(50);
    expect(stats.cancellationRate).toBe(25);
    expect(stats.noShowRate).toBe(25);
  });

  it("completed future appointment still counts in the denominator (≤100%)", () => {
    const s = computeAppointmentStats([appt("2026-10-05", "completed")], now);
    expect(s.completionRate).toBe(100);
  });

  it("empty → completionRate 0, other rates null", () => {
    const s = computeAppointmentStats([], now);
    expect(s.completionRate).toBe(0);
    expect(s.cancellationRate).toBeNull();
    expect(s.noShowRate).toBeNull();
  });

  it("charts exclude canceled and use the calendar day (UTC midnight and Israel midnight storage)", () => {
    const charts = buildAppointmentCharts([
      appt("2026-09-27", "scheduled", "09:00"), // Sunday (UTC midnight storage)
      { date: d("2026-09-26T21:00:00Z"), startTime: "14:00", endTime: "15:00", status: "completed" }, // Sunday at Israel midnight
      appt("2026-09-28", "canceled", "09:00"), // Monday, canceled
    ]);
    expect(charts.appointmentsByDayOfWeek[0]).toEqual({ day: "ראשון", count: 2 });
    expect(charts.appointmentsByDayOfWeek[1].count).toBe(0);
    expect(charts.appointmentsByHour).toEqual([
      { hour: 9, label: "9:00", count: 1 },
      { hour: 14, label: "14:00", count: 1 },
    ]);
    expect(charts.appointmentsByDate).toEqual([
      { date: "2026-09-27", count: 2 },
      { date: "2026-09-28", count: 1 },
    ]);
  });
});

describe("revenue", () => {
  const payments: PaymentLite[] = [
    { amount: 100, method: "cash", customerId: "c1", appointmentId: "a1", appointment: { service: { name: "אילוף פרטי" } } },
    { amount: 50, method: "bit", customerId: "c1", appointmentId: "a2", appointment: { service: null, priceListItem: { name: "טיפוח" } } },
    { amount: 30, method: "bit", customerId: "c2", appointmentId: "a3", appointment: null },
    { amount: 400, method: "credit_card", customerId: "c2", boardingStayId: "b1" },
    { amount: 700, method: "credit_card", customerId: "c3", orderId: "o1", order: { orderType: "training" } },
    { amount: 200, method: "bank_transfer", customerId: "c3", orderId: "o2", order: { orderType: "boarding" } },
    { amount: 80, method: "cash", customerId: "c4", orderId: "o3", order: { orderType: "sale" } },
    { amount: 20, method: null, customerId: "c4" },
  ];

  it("classifies by link precedence", () => {
    expect(classifyPayment(payments[0])).toEqual({ category: "appointments", name: "אילוף פרטי" });
    expect(classifyPayment(payments[1]).name).toBe("טיפוח");
    expect(classifyPayment(payments[2]).name).toBe("תור");
    expect(classifyPayment(payments[3])).toEqual({ category: "boarding", name: "פנסיון" });
    expect(classifyPayment(payments[4])).toEqual({ category: "training", name: "אילוף" });
    expect(classifyPayment(payments[5]).category).toBe("boarding");
    expect(classifyPayment(payments[6])).toEqual({ category: "orders", name: "מוצרים" });
    expect(classifyPayment(payments[7])).toEqual({ category: "other", name: "אחר" });
    expect(classifyPayment({ amount: 1, customerId: "x", orderId: "o", order: { orderType: "weird" } })).toEqual({ category: "orders", name: "הזמנות" });
  });

  it("Σ byCategory === Σ revenueByService === total", () => {
    const r = buildRevenueBreakdown(payments);
    const total = payments.reduce((s, p) => s + p.amount, 0);
    expect(r.total).toBe(total);
    expect(r.byCategory.reduce((s, c) => s + c.revenue, 0)).toBe(total);
    expect(r.revenueByService.reduce((s, c) => s + c.revenue, 0)).toBe(total);
    expect(r.byCategory.find((c) => c.category === "boarding")?.revenue).toBe(600);
  });

  it("folds the tail into 'אחר' and keeps the sum", () => {
    const many: PaymentLite[] = Array.from({ length: 12 }, (_, i) => ({
      amount: i + 1,
      customerId: "c",
      appointmentId: `a${i}`,
      appointment: { service: { name: `s${i}` } },
    }));
    many.push({ amount: 5, customerId: "c" }); // "אחר"
    const r = buildRevenueBreakdown(many, 8);
    expect(r.revenueByService).toHaveLength(8);
    expect(r.revenueByService[7].name).toBe("אחר");
    expect(r.revenueByService.reduce((s, c) => s + c.revenue, 0)).toBe(r.total);
  });

  it("byMethod groups with Hebrew labels", () => {
    const m = buildRevenueByMethod(payments);
    expect(m[0]).toEqual({ method: "credit_card", label: "אשראי", revenue: 1100, count: 2 });
    expect(m.find((x) => x.method === "bit")).toEqual({ method: "bit", label: "ביט", revenue: 80, count: 2 });
    expect(m.find((x) => x.method === "other")?.count).toBe(1);
  });

  it("monthly buckets by Israel month + prev year", () => {
    const rows = buildMonthlyRevenue(
      [
        { amount: 10, paidAt: d("2026-08-31T22:30:00Z") }, // 2026-09-01 01:30 Israel → Sep
        { amount: 5, paidAt: d("2025-09-15T10:00:00Z") },
        { amount: 7, paidAt: null },
      ],
      ["2026-08", "2026-09"],
      prevYearMonthKey
    );
    expect(rows).toEqual([
      { month: "2026-08", revenue: 0, prevYearRevenue: 0 },
      { month: "2026-09", revenue: 10, prevYearRevenue: 5 },
    ]);
  });
});

describe("customers", () => {
  it("retention = previous-period actives that came back", () => {
    const r = computeRetention(["a", "b", "c", "d"], ["b", "d", "e", "f"]);
    expect(r).toEqual({ returningCustomers: 2, customersWithAppointments: 4, retentionRate: 50 });
  });
  it("retention with empty base is null", () => {
    expect(computeRetention([], ["x"]).retentionRate).toBeNull();
  });
  it("avg revenue per PAYING customer", () => {
    expect(avgRevenuePerPayingCustomer(1000, 4)).toBe(250);
    expect(avgRevenuePerPayingCustomer(100, 3)).toBe(33.33);
    expect(avgRevenuePerPayingCustomer(0, 0)).toBeNull();
  });
  it("new vs returning split by customer createdAt", () => {
    const from = d("2026-09-01T00:00:00Z");
    const to = d("2026-09-30T00:00:00Z");
    expect(
      splitNewVsReturning(
        [
          { amount: 100, customerCreatedAt: d("2026-09-10T00:00:00Z") },
          { amount: 50, customerCreatedAt: d("2025-01-01T00:00:00Z") },
          { amount: 25, customerCreatedAt: null },
        ],
        from,
        to
      )
    ).toEqual({ newCustomers: 100, returningCustomers: 75 });
  });
});

describe("occupancy", () => {
  const from = d("2026-09-01T00:00:00Z");
  const to = d("2026-09-11T00:00:00Z"); // 10 days
  const now = d("2026-09-08T00:00:00Z");
  const rooms = [
    { id: "r1", capacity: 2 },
    { id: "r2", capacity: 1 },
  ];

  it("capacity = Σ capacity × days", () => {
    expect(computeOccupancy([], rooms, from, to, now)).toEqual({ occupiedNights: 0, capacityNights: 30, occupancyRate: 0 });
  });

  it("clips to the period, open stays end at min(now,to), ignores unknown rooms", () => {
    const res = computeOccupancy(
      [
        { checkIn: d("2026-08-28T00:00:00Z"), checkOut: d("2026-09-03T00:00:00Z"), roomId: "r1" }, // 2 nights in period
        { checkIn: d("2026-09-09T00:00:00Z"), checkOut: d("2026-09-20T00:00:00Z"), roomId: "r1" }, // 2 nights in period
        { checkIn: d("2026-09-05T00:00:00Z"), checkOut: null, roomId: "r2" }, // until now → 3 nights
        { checkIn: d("2026-09-02T00:00:00Z"), checkOut: d("2026-09-04T00:00:00Z"), roomId: "inactive" },
        { checkIn: d("2026-09-02T00:00:00Z"), checkOut: d("2026-09-04T00:00:00Z"), roomId: null },
      ],
      rooms,
      from,
      to,
      now
    );
    expect(res.occupiedNights).toBe(7);
    expect(res.capacityNights).toBe(30);
    expect(res.occupancyRate).toBe(23);
  });

  it("one dog in a capacity-2 room = 1 of 2", () => {
    const res = computeOccupancy(
      [{ checkIn: from, checkOut: to, roomId: "r1" }],
      [{ id: "r1", capacity: 2 }],
      from,
      to,
      to
    );
    expect(res).toEqual({ occupiedNights: 10, capacityNights: 20, occupancyRate: 50 });
  });

  it("no rooms → capacity 0, rate null", () => {
    expect(computeOccupancy([], [], from, to, now).occupancyRate).toBeNull();
  });
});
