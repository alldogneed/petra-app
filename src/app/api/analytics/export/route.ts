export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit } from "@/lib/rate-limit";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import { LEAD_SOURCES, LOST_REASON_CODES } from "@/lib/constants";
import { buildLeadSalesReport, EXCLUDED_ORDER_STATUSES } from "@/lib/lead-deal-value";
import {
  avgRevenuePerPayingCustomer,
  buildMonthlyRevenue,
  buildRevenueBreakdown,
  buildRevenueByMethod,
  computeAppointmentStats,
  PAYMENT_METHOD_LABELS_HE,
  splitNewVsReturning, MAX_CUSTOM_RANGE_DAYS } from "@/lib/analytics-metrics";
import { computeOutstandingBalances } from "@/lib/outstanding-balances";
import { isYmd, israelDayEnd, israelDayStart, lastMonthKeys, prevYearMonthKey } from "@/lib/report-dates";
import { buildLeadSourceRows } from "@/lib/sales-report";
import * as XLSX from "xlsx";

const LEAD_SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  LEAD_SOURCES.map((s) => [s.id, s.label])
);

const LOST_REASON_LABELS: Record<string, string> = Object.fromEntries(
  LOST_REASON_CODES.map((r) => [r.id, r.label])
);

const EXPORT_RATE_LIMIT = { max: 5, windowMs: 60 * 1000 };
/** Safety cap per query to prevent memory exhaustion on large date ranges */
const MAX_EXPORT_ROWS = 50_000;

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("he-IL");
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return "₪0";
  return `₪${n.toLocaleString("he-IL")}`;
}

const APPOINTMENT_STATUS: Record<string, string> = {
  scheduled: "מתוכנן",
  confirmed: "מאושר",
  completed: "הושלם",
  COMPLETED: "הושלם",
  canceled: "בוטל",
  no_show: "לא הגיע",
};

const PAYMENT_METHOD = PAYMENT_METHOD_LABELS_HE;

const PAYMENT_STATUS: Record<string, string> = {
  paid: "שולם",
  pending: "ממתין",
  partial: "חלקי",
  canceled: "בוטל",
  refunded: "הוחזר",
};

const ORDER_STATUS: Record<string, string> = {
  draft: "טיוטה",
  confirmed: "מאושרת",
  completed: "הושלמה",
  canceled: "בוטלה",
};

const TRAINING_TYPE: Record<string, string> = {
  HOME: "אילוף ביתי",
  BOARDING: "אילוף בפנסיון",
  SERVICE_DOG: "כלב שירות",
};

const TRAINING_STATUS: Record<string, string> = {
  ACTIVE: "פעיל",
  COMPLETED: "הושלם",
  CANCELED: "בוטל",
  PAUSED: "מושהה",
};

// Actual BoardingStay statuses in the system: reserved / checked_in / checked_out
const BOARDING_STATUS: Record<string, string> = {
  reserved: "הזמנה",
  checked_in: "בשהייה",
  checked_out: "הסתיימה",
  canceled: "בוטל",
};

const TASK_CATEGORY: Record<string, string> = {
  BOARDING: "פנסיון",
  TRAINING: "אילוף",
  LEADS: "לידים",
  GENERAL: "כללי",
  HEALTH: "בריאות",
  MEDICATION: "תרופות",
  FEEDING: "האכלה",
};

const TASK_PRIORITY: Record<string, string> = {
  LOW: "נמוכה",
  MEDIUM: "בינונית",
  HIGH: "גבוהה",
  URGENT: "דחוף",
};

const TASK_STATUS: Record<string, string> = {
  OPEN: "פתוחה",
  COMPLETED: "הושלמה",
  CANCELED: "בוטלה",
};

const PET_GENDER: Record<string, string> = {
  male: "זכר",
  female: "נקבה",
  unknown: "לא ידוע",
};

const PET_SPECIES: Record<string, string> = {
  dog: "כלב",
  cat: "חתול",
  other: "אחר",
};

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    // The export contains full revenue data (payments, order totals) — gate it
    // behind the same permission the analytics API uses to hide revenue.
    const membership = session.memberships.find((m) => m.businessId === businessId && m.isActive);
    const role = (membership?.role ?? "user") as TenantRole;
    if (!hasTenantPermission(role, TENANT_PERMS.FINANCE_SUMMARY, membership?.permissionOverrides)) {
      return NextResponse.json({ error: "אין לך הרשאה לייצא דוחות כספיים" }, { status: 403 });
    }

    const rl = rateLimit("export:analytics", businessId, EXPORT_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות ייצוא. נסה שוב בעוד דקה." }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (!fromParam || !toParam) {
      return new Response(JSON.stringify({ error: "חובה לציין טווח תאריכים (from, to)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // "YYYY-MM-DD" = Israel calendar days (same as /api/analytics). Legacy full date strings still parse.
    let fromDate: Date;
    let toDate: Date;
    if (isYmd(fromParam) && isYmd(toParam)) {
      fromDate = israelDayStart(fromParam <= toParam ? fromParam : toParam);
      toDate = israelDayEnd(fromParam <= toParam ? toParam : fromParam);
    } else {
      fromDate = new Date(fromParam);
      toDate = new Date(toParam);
      toDate.setHours(23, 59, 59, 999);
    }

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return new Response(JSON.stringify({ error: "תאריכים לא תקינים" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Same ~5-year cap as /api/analytics custom ranges.
    if (Math.abs(toDate.getTime() - fromDate.getTime()) > MAX_CUSTOM_RANGE_DAYS * 86_400_000) {
      return new Response(JSON.stringify({ error: "טווח התאריכים ארוך מדי (עד 5 שנים)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const monthKeys = lastMonthKeys(12, toDate);
    const [lastY, lastM] = monthKeys[monthKeys.length - 1].split("-").map(Number);
    const monthlyFrom = israelDayStart(`${prevYearMonthKey(monthKeys[0])}-01`);
    const monthlyTo = israelDayStart(new Date(Date.UTC(lastY, lastM, 1)).toISOString().slice(0, 10));

    // Run all queries in parallel
    const [
      customers,
      appointments,
      payments,
      orders,
      leads,
      leadsLostInRange,
      leadStages,
      trainingPrograms,
      boardingStays,
      tasks,
      pets,
      paidInRange,
      monthlyPayments,
      outstanding,
    ] = await Promise.all([
      // 1. Customers created in range
      prisma.customer.findMany({
        where: { businessId, createdAt: { gte: fromDate, lte: toDate } },
        include: {
          _count: { select: { pets: true, appointments: true } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_EXPORT_ROWS,
      }),
      // 2. Appointments in range
      prisma.appointment.findMany({
        where: { businessId, date: { gte: fromDate, lte: toDate } },
        include: {
          customer: { select: { name: true } },
          pet: { select: { name: true } },
          service: { select: { name: true } },
        },
        orderBy: { date: "desc" },
        take: MAX_EXPORT_ROWS,
      }),
      // 3. Payments in range
      prisma.payment.findMany({
        where: { businessId, createdAt: { gte: fromDate, lte: toDate } },
        include: {
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_EXPORT_ROWS,
      }),
      // 4. Orders in range
      prisma.order.findMany({
        where: { businessId, createdAt: { gte: fromDate, lte: toDate } },
        include: {
          customer: { select: { name: true } },
          lines: true,
          payments: { select: { amount: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_EXPORT_ROWS,
      }),
      // 5. Leads in range
      prisma.lead.findMany({
        where: { businessId, createdAt: { gte: fromDate, lte: toDate } },
        orderBy: { createdAt: "desc" },
        take: MAX_EXPORT_ROWS,
      }),
      // 5b. Leads lost in range (by lostAt, regardless of creation date)
      prisma.lead.findMany({
        where: { businessId, lostAt: { gte: fromDate, lte: toDate } },
        select: { lostReasonCode: true },
        take: MAX_EXPORT_ROWS,
      }),
      // Lead stages for name lookup
      prisma.leadStage.findMany({
        where: { businessId },
        select: { id: true, name: true, isWon: true, isLost: true },
      }),
      // 6. Training programs started in range
      prisma.trainingProgram.findMany({
        where: { businessId, startDate: { gte: fromDate, lte: toDate } },
        include: {
          dog: { select: { name: true } },
          customer: { select: { name: true } },
          sessions: { select: { id: true } },
        },
        orderBy: { startDate: "desc" },
        take: MAX_EXPORT_ROWS,
      }),
      // 7. Boarding stays in range
      prisma.boardingStay.findMany({
        where: { businessId, checkIn: { gte: fromDate, lte: toDate } },
        include: {
          pet: { select: { name: true } },
          customer: { select: { name: true } },
          room: { select: { name: true } },
        },
        orderBy: { checkIn: "desc" },
        take: MAX_EXPORT_ROWS,
      }),
      // 8. Tasks in range
      prisma.task.findMany({
        where: { businessId, createdAt: { gte: fromDate, lte: toDate } },
        orderBy: { createdAt: "desc" },
        take: MAX_EXPORT_ROWS,
      }),
      // 9. Pets created in range
      prisma.pet.findMany({
        where: {
          OR: [
            { customer: { businessId } },
            { businessId },
          ],
          createdAt: { gte: fromDate, lte: toDate },
        },
        include: {
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_EXPORT_ROWS,
      }),
      // 10. Paid payments by paidAt — revenue (same definition as /api/analytics)
      prisma.payment.findMany({
        where: { businessId, status: "paid", paidAt: { gte: fromDate, lte: toDate } },
        select: {
          amount: true,
          method: true,
          customerId: true,
          appointmentId: true,
          boardingStayId: true,
          orderId: true,
          appointment: { select: { service: { select: { name: true } }, priceListItem: { select: { name: true } } } },
          order: { select: { orderType: true } },
          customer: { select: { createdAt: true } },
        },
        take: MAX_EXPORT_ROWS,
      }),
      // 11. Last 12 months (+ a year earlier) ending with the month of `to`
      prisma.payment.findMany({
        where: { businessId, status: "paid", paidAt: { gte: monthlyFrom, lt: monthlyTo } },
        select: { amount: true, paidAt: true },
        take: MAX_EXPORT_ROWS * 2,
      }),
      // 12. Outstanding balances (snapshot)
      computeOutstandingBalances(prisma, businessId),
    ]);

    const stageMap = new Map(leadStages.map((s) => [s.id, s.name]));
    const wonStageSet = new Set(leadStages.filter((s) => s.isWon).map((s) => s.id));
    const lostStageSet = new Set(leadStages.filter((s) => s.isLost).map((s) => s.id));

    // Lead sales — leads WON in range (by wonAt) + orders their customers placed since closing
    const wonStageIds = leadStages.filter((s) => s.isWon).map((s) => s.id);
    const wonInRange = await prisma.lead.findMany({
      where: { businessId, stage: { in: wonStageIds }, wonAt: { gte: fromDate, lte: toDate } },
      select: { id: true, name: true, wonAt: true, dealValue: true, customerId: true },
      orderBy: { wonAt: "desc" },
      take: MAX_EXPORT_ROWS,
    });
    const wonCustomerIds = Array.from(new Set(wonInRange.map((l) => l.customerId).filter((id): id is string => !!id)));
    const earliestWon = wonInRange.reduce<Date | null>((min, l) => (l.wonAt && (!min || l.wonAt < min) ? l.wonAt : min), null);
    const [wonCustomerOrders, wonOwnerLeads] = wonCustomerIds.length > 0 && earliestWon
      ? await Promise.all([
          prisma.order.findMany({
            where: { businessId, customerId: { in: wonCustomerIds }, createdAt: { gte: earliestWon }, status: { notIn: EXCLUDED_ORDER_STATUSES } },
            select: { customerId: true, total: true, status: true, createdAt: true },
            orderBy: { createdAt: "asc" },
            take: MAX_EXPORT_ROWS,
          }),
          prisma.lead.findMany({
            where: { businessId, customerId: { in: wonCustomerIds }, stage: { in: wonStageIds }, wonAt: { not: null } },
            select: { id: true, wonAt: true, customerId: true },
            take: MAX_EXPORT_ROWS,
          }),
        ])
      : [[], []];
    const leadSales = buildLeadSalesReport(
      wonInRange.filter((l) => l.wonAt).map((l) => ({ ...l, wonAt: l.wonAt as Date })),
      wonCustomerOrders,
      MAX_EXPORT_ROWS,
      wonOwnerLeads.map((l) => ({ ...l, wonAt: l.wonAt as Date })),
    );

    const wb = XLSX.utils.book_new();
    const fromLabel = fmt(fromDate);
    const toLabel = fmt(toDate);

    // ── Sheet 1: Summary ──
    // Same definitions as /api/analytics (src/lib/analytics-metrics.ts)
    const revenue = buildRevenueBreakdown(paidInRange);
    const totalRevenue = revenue.total;
    const payingCustomers = new Set(paidInRange.map((p) => p.customerId)).size;
    const apptStats = computeAppointmentStats(appointments, new Date());
    const rateLabel = (n: number | null) => (n == null ? "—" : `${n}%`);

    const summaryRows = [
      ["סיכום דוח", `${fromLabel} – ${toLabel}`],
      [],
      ["מדד", "ערך"],
      ["לקוחות חדשים", customers.length],
      ["תורים", appointments.length],
      ["תורים שהושלמו", apptStats.completed],
      ["תורים שבוטלו", apptStats.canceled],
      ["לא הגיעו", apptStats.noShow],
      ["אחוז השלמה (מתורים שמועדם עבר)", `${apptStats.completionRate}%`],
      ["אחוז ביטולים", rateLabel(apptStats.cancellationRate)],
      ["הכנסות (שולם בטווח)", fmtCurrency(totalRevenue)],
      ["תשלומים ששולמו בטווח", paidInRange.length],
      ["לקוחות משלמים", payingCustomers],
      ["הכנסה ממוצעת ללקוח משלם", fmtCurrency(avgRevenuePerPayingCustomer(totalRevenue, payingCustomers) ?? 0)],
      ["תשלומים שנרשמו בטווח (כל הסטטוסים)", payments.length],
      ["הזמנות", orders.length],
      ["לידים חדשים", leads.length],
      ["מהם נסגרו (won)", leads.filter((l) => wonStageSet.has(l.stage)).length],
      ["מהם אבדו (lost)", leads.filter((l) => lostStageSet.has(l.stage)).length],
      ["לידים שנסגרו בטווח (לפי תאריך סגירה)", leadSales.wonCount],
      ["ערך עסקאות שנסגרו", fmtCurrency(leadSales.dealValueTotal)],
      ["הזמנות מאז הסגירה", fmtCurrency(leadSales.ordersTotal)],
      ["סה״כ מכירות מלידים", fmtCurrency(leadSales.total)],
      ["תוכניות אילוף", trainingPrograms.length],
      ["שהיות בפנסיון", boardingStays.length],
      ["משימות", tasks.length],
      ["משימות שהושלמו", tasks.filter((t) => t.status === "COMPLETED").length],
      ["חיות מחמד חדשות", pets.length],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = [{ wch: 25 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "סיכום");

    // ── Sheet 1b: Finance (same definitions as the /analytics finance section) ──
    const split = splitNewVsReturning(
      paidInRange.map((p) => ({ amount: p.amount, customerCreatedAt: p.customer?.createdAt ?? null })),
      fromDate,
      toDate,
    );
    const financeRows: (string | number)[][] = [
      ["כספים", `${fromLabel} – ${toLabel}`],
      [],
      ["הכנסות לפי קטגוריה", "סכום"],
      ...revenue.byCategory.map((c) => [c.label, c.revenue]),
      ["סה״כ", totalRevenue],
      [],
      ["הכנסות לפי שירות", "סכום"],
      ...revenue.revenueByService.map((r) => [r.name, r.revenue]),
      [],
      ["אמצעי תשלום", "סכום", "מספר תשלומים"],
      ...buildRevenueByMethod(paidInRange).map((m) => [m.label, m.revenue, m.count]),
      [],
      ["לקוחות חדשים (נוצרו בטווח)", split.newCustomers],
      ["לקוחות קיימים", split.returningCustomers],
      [],
      ["חודש", "הכנסות", "אותו חודש בשנה הקודמת"],
      ...buildMonthlyRevenue(monthlyPayments, monthKeys, prevYearMonthKey).map((m) => [m.month, m.revenue, m.prevYearRevenue]),
      [],
      ["יתרות פתוחות (נכון להיום)", `${outstanding.rows.length} לקוחות`, Math.round(outstanding.grandTotal * 100) / 100],
      ["לקוח", "סה״כ חוב", "הזמנות לא משולמות", "תשלומים ממתינים", "פריט פתוח ותיק"],
      ...outstanding.rows.map((r) => [
        r.name || "לקוח לא ידוע",
        Math.round(r.total * 100) / 100,
        Math.round(r.ordersOutstanding * 100) / 100,
        Math.round(r.pendingAmount * 100) / 100,
        fmt(r.oldest),
      ]),
    ];
    const wsFinance = XLSX.utils.aoa_to_sheet(financeRows);
    wsFinance["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsFinance, "כספים");

    // ── Sheet 2: Customers ──
    const customerHeaders = ["שם", "טלפון", "מייל", "כתובת", "תגיות", "תאריך הצטרפות", "מספר חיות", "מספר תורים"];
    const customerRows: (string | number)[][] = [customerHeaders];
    for (const c of customers) {
      const tags = c.tags ? (Array.isArray(c.tags) ? (c.tags as string[]).join(", ") : String(c.tags)) : "";
      customerRows.push([
        c.name,
        c.phone || "",
        c.email || "",
        c.address || "",
        tags,
        fmt(c.createdAt),
        c._count.pets,
        c._count.appointments,
      ]);
    }
    const wsCustomers = XLSX.utils.aoa_to_sheet(customerRows);
    wsCustomers["!cols"] = [{ wch: 20 }, { wch: 14 }, { wch: 24 }, { wch: 24 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsCustomers, "לקוחות");

    // ── Sheet 3: Appointments ──
    const apptHeaders = ["תאריך", "שעת התחלה", "שעת סיום", "סטטוס", "לקוח", "חיית מחמד", "שירות", "הערות"];
    const apptRows: (string | number)[][] = [apptHeaders];
    for (const a of appointments) {
      apptRows.push([
        fmt(a.date),
        a.startTime || "",
        a.endTime || "",
        APPOINTMENT_STATUS[a.status] ?? a.status,
        a.customer?.name ?? "",
        a.pet?.name ?? "",
        a.service?.name ?? "",
        a.notes || "",
      ]);
    }
    const wsAppt = XLSX.utils.aoa_to_sheet(apptRows);
    wsAppt["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsAppt, "תורים");

    // ── Sheet 4: Payments ──
    const payHeaders = ["סכום", "אמצעי תשלום", "סטטוס", "לקוח", "תאריך תשלום", "הערות"];
    const payRows: (string | number)[][] = [payHeaders];
    for (const p of payments) {
      payRows.push([
        p.amount,
        PAYMENT_METHOD[p.method] ?? p.method ?? "",
        PAYMENT_STATUS[p.status] ?? p.status,
        p.customer?.name ?? "",
        fmt(p.paidAt || p.createdAt),
        p.notes || "",
      ]);
    }
    const wsPay = XLSX.utils.aoa_to_sheet(payRows);
    wsPay["!cols"] = [{ wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsPay, "תשלומים");

    // ── Sheet 5: Orders ──
    const orderHeaders = ["מס׳ הזמנה", "לקוח", "סטטוס", "פריטים", "סה״כ", "שולם", "יתרה", "תאריך"];
    const orderRows: (string | number)[][] = [orderHeaders];
    for (const o of orders) {
      const linesSummary = o.lines.map((l) => l.name).filter(Boolean).join(", ");
      const paidAmount = o.payments
        .filter((p) => p.status === "paid")
        .reduce((s, p) => s + p.amount, 0);
      const total = o.total ?? 0;
      orderRows.push([
        o.id.slice(0, 8),
        o.customer?.name ?? "",
        ORDER_STATUS[o.status] ?? o.status,
        linesSummary,
        total,
        paidAmount,
        Math.max(0, total - paidAmount),
        fmt(o.createdAt),
      ]);
    }
    const wsOrders = XLSX.utils.aoa_to_sheet(orderRows);
    wsOrders["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 10 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsOrders, "הזמנות");

    // ── Sheet 6: Leads ──
    const leadHeaders = ["שם", "טלפון", "מקור", "שלב", "ערך עסקה", "תאריך יצירה", "תאריך סגירה", "סיבת אובדן"];
    const leadRows: (string | number)[][] = [leadHeaders];
    for (const l of leads) {
      leadRows.push([
        l.name,
        l.phone || "",
        l.source || "",
        stageMap.get(l.stage) ?? l.stage ?? "",
        l.dealValue ?? "",
        fmt(l.createdAt),
        l.wonAt || l.lostAt ? fmt(l.wonAt || l.lostAt) : "",
        l.lostReasonCode || l.lostReasonText || "",
      ]);
    }
    const wsLeads = XLSX.utils.aoa_to_sheet(leadRows);
    wsLeads["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsLeads, "לידים");

    // ── Sheet: Lead sales (won in range) ──
    const salesRows: (string | number)[][] = [["ליד", "תאריך סגירה", "ערך עסקה", "מס׳ הזמנות מאז הסגירה", "סכום הזמנות מאז הסגירה", "סה״כ"]];
    for (const r of leadSales.rows) {
      salesRows.push([r.name, fmt(r.wonAt), r.dealValue ?? "", r.ordersCount, r.ordersTotal, r.total]);
    }
    const wsSales = XLSX.utils.aoa_to_sheet(salesRows);
    wsSales["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsSales, "מכירות מלידים");

    // ── Sheet 6b: Leads by Source (created in range; won/lost = current stage; conversion = won/(won+lost)) ──
    const sourceStats = buildLeadSourceRows(
      leads.map((l) => ({
        key: l.source || "manual",
        isWon: wonStageSet.has(l.stage),
        isLost: lostStageSet.has(l.stage),
        dealValue: l.dealValue,
      })),
      true,
    );
    const sourceHeaders = ["מקור", "סה״כ לידים", "נסגרו", "אבדו", "פעילים", "אחוז המרה", "ערך עסקאות שנסגרו"];
    const sourceRows: (string | number)[][] = [sourceHeaders];
    for (const r of sourceStats) {
      sourceRows.push([
        LEAD_SOURCE_LABELS[r.source] ?? r.source,
        r.total,
        r.won,
        r.lost,
        r.open,
        rateLabel(r.conversionRate),
        r.wonValue ?? 0,
      ]);
    }
    const wsSources = XLSX.utils.aoa_to_sheet(sourceRows);
    wsSources["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsSources, "לידים לפי מקור");

    // ── Sheet 6c: Lost Reasons ──
    const lostReasonAgg = new Map<string, number>();
    for (const l of leadsLostInRange) {
      const code = l.lostReasonCode || "OTHER";
      lostReasonAgg.set(code, (lostReasonAgg.get(code) || 0) + 1);
    }
    const lostReasonHeaders = ["סיבת אובדן", "כמות"];
    const lostReasonRows: (string | number)[][] = [lostReasonHeaders];
    for (const [code, count] of Array.from(lostReasonAgg.entries()).sort((a, b) => b[1] - a[1])) {
      lostReasonRows.push([LOST_REASON_LABELS[code] ?? code, count]);
    }
    const wsLostReasons = XLSX.utils.aoa_to_sheet(lostReasonRows);
    wsLostReasons["!cols"] = [{ wch: 22 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsLostReasons, "סיבות אובדן לידים");

    // ── Sheet 7: Training Programs ──
    const trainingHeaders = ["שם תוכנית", "כלב", "לקוח", "סוג", "סטטוס", "מפגשים מתוכננים", "מפגשים שבוצעו", "מחיר", "תאריך התחלה"];
    const trainingRows: (string | number)[][] = [trainingHeaders];
    for (const tp of trainingPrograms) {
      trainingRows.push([
        tp.name || "",
        tp.dog?.name ?? "",
        tp.customer?.name ?? "",
        TRAINING_TYPE[tp.trainingType] ?? tp.trainingType ?? "",
        TRAINING_STATUS[tp.status] ?? tp.status,
        tp.totalSessions ?? "",
        tp.sessions.length,
        tp.price ?? "",
        fmt(tp.startDate),
      ]);
    }
    const wsTraining = XLSX.utils.aoa_to_sheet(trainingRows);
    wsTraining["!cols"] = [{ wch: 20 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsTraining, "אילוף");

    // ── Sheet 8: Boarding Stays ──
    const boardingHeaders = ["חיית מחמד", "לקוח", "חדר", "כניסה", "יציאה", "סטטוס", "הערות"];
    const boardingRows: (string | number)[][] = [boardingHeaders];
    for (const bs of boardingStays) {
      boardingRows.push([
        bs.pet?.name ?? "",
        bs.customer?.name ?? "",
        bs.room?.name ?? "",
        fmt(bs.checkIn),
        fmt(bs.checkOut),
        BOARDING_STATUS[bs.status] ?? bs.status,
        bs.notes || "",
      ]);
    }
    const wsBoarding = XLSX.utils.aoa_to_sheet(boardingRows);
    wsBoarding["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsBoarding, "פנסיון");

    // ── Sheet 9: Tasks ──
    const taskHeaders = ["כותרת", "תיאור", "קטגוריה", "עדיפות", "סטטוס", "תאריך יעד", "הושלם בתאריך"];
    const taskRows: (string | number)[][] = [taskHeaders];
    for (const t of tasks) {
      taskRows.push([
        t.title || "",
        t.description || "",
        TASK_CATEGORY[t.category] ?? t.category ?? "",
        TASK_PRIORITY[t.priority] ?? t.priority ?? "",
        TASK_STATUS[t.status] ?? t.status,
        t.dueDate ? fmt(t.dueDate) : t.dueAt ? fmt(t.dueAt) : "",
        t.completedAt ? fmt(t.completedAt) : "",
      ]);
    }
    const wsTasks = XLSX.utils.aoa_to_sheet(taskRows);
    wsTasks["!cols"] = [{ wch: 22 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsTasks, "משימות");

    // ── Sheet 10: Pets ──
    const petHeaders = ["שם", "סוג", "גזע", "מין", "תאריך לידה", "משקל", "בעלים"];
    const petRows: (string | number)[][] = [petHeaders];
    for (const p of pets) {
      petRows.push([
        p.name,
        PET_SPECIES[p.species] ?? p.species ?? "",
        p.breed || "",
        p.gender ? (PET_GENDER[p.gender] ?? p.gender) : "",
        p.birthDate ? fmt(p.birthDate) : "",
        p.weight ?? "",
        p.customer?.name ?? "",
      ]);
    }
    const wsPets = XLSX.utils.aoa_to_sheet(petRows);
    wsPets["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsPets, "חיות מחמד");

    // ── Write buffer & respond ──
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const today = new Date().toISOString().slice(0, 10);

    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="petra-report-${today}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("GET /api/analytics/export error:", error);
    return new Response(JSON.stringify({ error: "שגיאה בייצוא הדוח" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
