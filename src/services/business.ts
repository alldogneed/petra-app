/**
 * Business service — settings, team, analytics, dashboard, onboarding.
 *
 * All functions are business-scoped (businessId first param).
 * No Request/Response knowledge. Throws ServiceError on failure.
 *
 * Side effects that stay in routes:
 *   - sendWhatsAppMessage (on first phone set — route checks wasPhoneEmpty + newPhone)
 *   - logCurrentUserActivity (in settings PATCH route)
 *   - Vercel Blob upload (logo route stays as-is)
 */

import { ACTIVE_ORDER_STATUSES } from "@/lib/constants";
import { attributionWindowStart, buildLeadAttributionReport } from "@/lib/lead-attribution";
import { buildLeadSalesReport, EXCLUDED_ORDER_STATUSES } from "@/lib/lead-deal-value";
import type { AnalyticsData } from "@/lib/analytics-types";
import {
  avgRevenuePerPayingCustomer,
  BOARDING_CANCELED_STATUSES,
  buildAppointmentCharts,
  buildMonthlyRevenue,
  buildRevenueBreakdown,
  buildRevenueByMethod,
  computeAppointmentStats,
  computeOccupancy,
  computeRetention,
  isCompletedStatus,
  resolveAnalyticsRange,
  splitNewVsReturning,
} from "@/lib/analytics-metrics";
import { computeOutstandingBalances } from "@/lib/outstanding-balances";
import { israelDayStart, lastMonthKeys, pct, pctChange, prevYearMonthKey } from "@/lib/report-dates";
import { buildLeadSourceRows } from "@/lib/sales-report";
import type { DbClient } from "./supabase";
import type { Prisma } from "@prisma/client";
import {
  israelOverviewBoundaries,
  keysetAfter,
  paginate,
  cleanText,
  ACTIVITY_PAGE_MAX,
  ACTIVITY_EXPORT_MAX_ROWS,
  AI_ACTIVITY_WINDOW_DAYS,
  type ActivityQuery,
  type AiActivityQuery,
} from "@/lib/business-admin-activity";
import { ServiceError } from "./types";
import { validateIsraeliPhone, validateEmail } from "@/lib/validation";
import { VALID_LEGAL_ENTITY_TYPES } from "@/lib/legal-entity";

export { ServiceError };
export type { DbClient };

// ─── Sensitive-field stripping ─────────────────────────────────────────────

const SENSITIVE_FIELDS = [
  "webhookApiKey",
  "cardcomToken",
  "cardcomTokenExpiry",
  "cardcomPendingCode",
  "cardcomRecurringId",
  "cardcomDealId",
] as const;

function stripSensitive(business: Record<string, unknown>) {
  const safe = { ...business };
  for (const field of SENSITIVE_FIELDS) delete safe[field];
  return safe;
}

// ─── Settings ─────────────────────────────────────────────────────────────

export async function getBusinessSettings(businessId: string, db: DbClient) {
  const business = await db.business.findUnique({
    where: { id: businessId },
    include: { _count: { select: { customers: true, appointments: true } } },
  });
  if (!business) throw new ServiceError("Business not found", "NOT_FOUND");
  return stripSensitive(business as Record<string, unknown>);
}

export interface UpdateBusinessSettingsInput {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string;
  logo?: string;
  vatNumber?: string;
  businessRegNumber?: string;
  legalEntityType?: string | null;
  vatEnabled?: boolean;
  vatRate?: number;
  boardingCalcMode?: string;
  boardingMinNights?: number;
  boardingCheckInTime?: string;
  boardingCheckOutTime?: string;
  boardingPricePerNight?: number;
  customerTags?: string[] | string;
  cancellationPolicy?: string;
  bookingWelcomeText?: string;
  bookingRequiresApproval?: boolean;
  depositInstructions?: string;
  sdSettings?: unknown;
  whatsappRemindersEnabled?: boolean;
  whatsappReminderLeadHours?: number;
}

export async function updateBusinessSettings(
  businessId: string,
  db: DbClient,
  input: UpdateBusinessSettingsInput
): Promise<{ updated: Record<string, unknown>; wasPhoneEmpty: boolean; newPhone: string | null }> {
  const existing = await db.business.findUnique({ where: { id: businessId } });
  if (!existing) throw new ServiceError("Business not found", "NOT_FOUND");

  const wasPhoneEmpty = !existing.phone;
  const {
    name, phone, email, address, logo, vatNumber, businessRegNumber,
    legalEntityType, vatEnabled, vatRate, boardingCalcMode, boardingMinNights,
    boardingCheckInTime, boardingCheckOutTime, boardingPricePerNight,
    customerTags, cancellationPolicy, bookingWelcomeText, bookingRequiresApproval, depositInstructions,
    sdSettings, whatsappRemindersEnabled, whatsappReminderLeadHours,
  } = input;

  // ── Validation ─────────────────────────────────────────────────────────
  // The settings form echoes the FULL business object, so a business that never
  // uploaded a logo sends logo:null — that must not fail validation (it used to
  // 400 EVERY business-info save for logo-less businesses). null clears/keeps
  // empty; only validate actual string values.
  if (logo !== undefined && logo !== null) {
    if (typeof logo !== "string" || logo.length > 2000) {
      throw new ServiceError("כתובת לוגו לא תקינה", "VALIDATION");
    }
    const lower = logo.toLowerCase().trim();
    if (lower.startsWith("javascript:") || lower.startsWith("data:")) {
      throw new ServiceError("כתובת לוגו לא תקינה", "VALIDATION");
    }
  }
  if (vatRate !== undefined) {
    const n = Number(vatRate);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw new ServiceError('שיעור מע"מ לא תקין (0-100)', "VALIDATION");
    }
  }
  if (boardingPricePerNight !== undefined) {
    const n = Number(boardingPricePerNight);
    if (!Number.isFinite(n) || n < 0 || n > 100000) {
      throw new ServiceError("מחיר ללילה לא תקין", "VALIDATION");
    }
  }
  if (boardingMinNights !== undefined) {
    const n = Number(boardingMinNights);
    if (!Number.isFinite(n) || n < 0 || n > 365 || !Number.isInteger(n)) {
      throw new ServiceError("מינימום לילות לא תקין", "VALIDATION");
    }
  }
  if (whatsappReminderLeadHours !== undefined) {
    const n = Number(whatsappReminderLeadHours);
    if (!Number.isFinite(n) || n < 0 || n > 168) {
      throw new ServiceError("שעות תזכורת לא תקינות (0-168)", "VALIDATION");
    }
  }
  // validateIsraeliPhone/validateEmail return an error MESSAGE when invalid
  // and null when valid — a truthy result means invalid.
  if (phone !== undefined && phone !== null && phone !== "") {
    if (typeof phone !== "string" || validateIsraeliPhone(String(phone)) !== null) {
      throw new ServiceError("מספר טלפון לא תקין", "VALIDATION");
    }
  }
  if (email !== undefined && email !== null) {
    if (typeof email !== "string" || email.length > 254 || validateEmail(email) !== null) {
      throw new ServiceError("כתובת אימייל לא תקינה", "VALIDATION");
    }
  }
  if (address !== undefined && typeof address === "string" && address.length > 500) {
    throw new ServiceError("כתובת ארוכה מדי (עד 500 תווים)", "VALIDATION");
  }
  if (vatNumber !== undefined && typeof vatNumber === "string" && vatNumber.length > 20) {
    throw new ServiceError("ח.פ./עוסק לא תקין", "VALIDATION");
  }
  if (businessRegNumber !== undefined && typeof businessRegNumber === "string" && businessRegNumber.length > 20) {
    throw new ServiceError("מספר רישום עסק לא תקין", "VALIDATION");
  }
  if (name !== undefined && (typeof name !== "string" || name.length > 200)) {
    throw new ServiceError("שם עסק ארוך מדי (עד 200 תווים)", "VALIDATION");
  }
  if (cancellationPolicy !== undefined && typeof cancellationPolicy === "string" && cancellationPolicy.length > 5000) {
    throw new ServiceError("מדיניות ביטול ארוכה מדי", "VALIDATION");
  }
  if (bookingWelcomeText !== undefined && typeof bookingWelcomeText === "string" && bookingWelcomeText.length > 2000) {
    throw new ServiceError("טקסט ברוכים הבאים ארוך מדי", "VALIDATION");
  }
  if (depositInstructions !== undefined && typeof depositInstructions === "string" && depositInstructions.length > 2000) {
    throw new ServiceError("הנחיות מקדמה ארוכות מדי (מקסימום 2000 תווים)", "VALIDATION");
  }
  if (sdSettings !== undefined && typeof sdSettings === "string" && sdSettings.length > 10000) {
    throw new ServiceError("הגדרות כלבי שירות גדולות מדי", "VALIDATION");
  }
  if (sdSettings !== undefined && typeof sdSettings === "object" && JSON.stringify(sdSettings).length > 10000) {
    throw new ServiceError("הגדרות כלבי שירות גדולות מדי", "VALIDATION");
  }
  // customerTags is stored (and sent by clients) as a JSON string —
  // Business.customerTags is a String column. Accept both the string
  // wire format and a plain array; validate the parsed array either way.
  let customerTagsArr: unknown = customerTags;
  if (customerTags !== undefined) {
    if (typeof customerTagsArr === "string") {
      try {
        customerTagsArr = JSON.parse(customerTagsArr);
      } catch {
        throw new ServiceError("תגיות לקוח לא תקינות (מקסימום 100 תגיות, 50 תווים לכל אחת)", "VALIDATION");
      }
    }
    if (
      !Array.isArray(customerTagsArr) ||
      customerTagsArr.length > 100 ||
      customerTagsArr.some((t: unknown) => typeof t !== "string" || t.length > 50)
    ) {
      throw new ServiceError("תגיות לקוח לא תקינות (מקסימום 100 תגיות, 50 תווים לכל אחת)", "VALIDATION");
    }
  }

  const VALID_BOARDING_CALC_MODES = ["nights", "days", "calendar_days"];
  const TIME_RE = /^\d{2}:\d{2}$/;

  if (legalEntityType !== undefined && legalEntityType !== null && !VALID_LEGAL_ENTITY_TYPES.includes(legalEntityType)) {
    throw new ServiceError("סוג ישות משפטית לא תקין", "VALIDATION");
  }
  if (boardingCalcMode !== undefined && !VALID_BOARDING_CALC_MODES.includes(boardingCalcMode)) {
    throw new ServiceError("מצב חישוב פנסיון לא תקין", "VALIDATION");
  }
  if (boardingCheckInTime !== undefined && (typeof boardingCheckInTime !== "string" || !TIME_RE.test(boardingCheckInTime))) {
    throw new ServiceError("שעת צ'ק-אין לא תקינה (HH:MM)", "VALIDATION");
  }
  if (boardingCheckOutTime !== undefined && (typeof boardingCheckOutTime !== "string" || !TIME_RE.test(boardingCheckOutTime))) {
    throw new ServiceError("שעת צ'ק-אאוט לא תקינה (HH:MM)", "VALIDATION");
  }

  // ── Build update payload ──────────────────────────────────────────────
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (phone !== undefined) data.phone = phone;
  if (email !== undefined) data.email = email;
  if (address !== undefined) data.address = address;
  if (logo !== undefined) data.logo = logo;
  if (vatNumber !== undefined) data.vatNumber = vatNumber;
  if (businessRegNumber !== undefined) data.businessRegNumber = businessRegNumber;
  if (legalEntityType !== undefined) {
    data.legalEntityType = legalEntityType || null;
    if (legalEntityType === "עוסק פטור") data.vatEnabled = false;
    else if (legalEntityType && vatEnabled === undefined) data.vatEnabled = true;
  }
  if (vatEnabled !== undefined) data.vatEnabled = Boolean(vatEnabled);
  if (vatRate !== undefined) data.vatRate = Number(vatRate);
  if (boardingCalcMode !== undefined) data.boardingCalcMode = boardingCalcMode;
  if (boardingMinNights !== undefined) data.boardingMinNights = Number(boardingMinNights);
  if (boardingCheckInTime !== undefined) data.boardingCheckInTime = boardingCheckInTime;
  if (boardingCheckOutTime !== undefined) data.boardingCheckOutTime = boardingCheckOutTime;
  if (boardingPricePerNight !== undefined) data.boardingPricePerNight = Number(boardingPricePerNight);
  if (customerTags !== undefined) data.customerTags = JSON.stringify(customerTagsArr);
  if (cancellationPolicy !== undefined) data.cancellationPolicy = cancellationPolicy;
  if (bookingWelcomeText !== undefined) data.bookingWelcomeText = bookingWelcomeText;
  if (bookingRequiresApproval !== undefined) data.bookingRequiresApproval = Boolean(bookingRequiresApproval);
  if (depositInstructions !== undefined) data.depositInstructions = depositInstructions;
  if (sdSettings !== undefined) data.sdSettings = sdSettings;
  if (whatsappRemindersEnabled !== undefined) data.whatsappRemindersEnabled = Boolean(whatsappRemindersEnabled);
  if (whatsappReminderLeadHours !== undefined) data.whatsappReminderLeadHours = whatsappReminderLeadHours;

  const business = await db.business.update({
    where: { id: businessId },
    data: data as any,
    include: { _count: { select: { customers: true, appointments: true } } },
  });

  return {
    updated: stripSensitive(business as Record<string, unknown>),
    wasPhoneEmpty,
    newPhone: typeof phone === "string" ? phone : null,
  };
}

// ─── Dashboard ────────────────────────────────────────────────────────────

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

export async function getDashboardMetrics(
  businessId: string,
  db: DbClient,
  opts: { canSeeRevenueSummary: boolean; anchorDate?: string | null }
) {
  const { canSeeRevenueSummary, anchorDate } = opts;

  const IL_TZ = "Asia/Jerusalem";
  const now = new Date();
  const ilFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: IL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // The dashboard normally reports on today; anchorDate ("YYYY-MM-DD") moves the
  // whole "day" window forwards or backwards so the user can look ahead.
  const anchorValid = !!anchorDate && /^\d{4}-\d{2}-\d{2}$/.test(anchorDate);
  const [ilYear, ilMonth, ilDay] = (anchorValid ? anchorDate! : ilFormatter.format(now))
    .split("-")
    .map(Number);
  const todayStart = new Date(
    new Date(`${ilYear}-${String(ilMonth).padStart(2, "0")}-${String(ilDay).padStart(2, "0")}T00:00:00+03:00`).getTime()
  );
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  const monthStart = new Date(`${ilYear}-${String(ilMonth).padStart(2, "0")}-01T00:00:00+03:00`);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  const sixMonthsStart = new Date(ilYear, ilMonth - 1 - 5, 1);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const openStages = await db.leadStage.findMany({
    where: { businessId, isWon: false, isLost: false },
    select: { id: true },
  });
  const openStageIds = openStages.map((s) => s.id);

  const [
    totalCustomers,
    totalPets,
    todayAppointments,
    upcomingAppointments,
    recentTasks,
    confirmedOrdersRaw,
    monthPayments,
    openLeads,
    activeOrders,
    upcomingTraining,
    upcomingGrooming,
    activeBoardingStays,
    topServiceResult,
    recentOrders,
    todayTasks,
    overdueTasks,
    urgentLeads,
    pendingBookings,
    todayArrivals,
    todayDepartures,
    tomorrowAppointments,
    atRiskRaw,
    allPetsWithBirthdays,
    todayRevenueAgg,
    sixMonthPayments,
  ] = await Promise.all([
    db.customer.count({ where: { businessId } }),
    db.pet.count({ where: { OR: [{ customer: { businessId } }, { businessId }] } }),
    db.appointment.count({
      where: { businessId, date: { gte: todayStart, lte: todayEnd }, status: { not: "canceled" } },
    }),
    db.appointment.findMany({
      where: { businessId, date: { gte: todayStart }, status: "scheduled" },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        pet: { select: { name: true, species: true } },
        service: { select: { id: true, name: true, color: true, type: true } },
        priceListItem: { select: { id: true, name: true, category: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 8,
    }),
    db.task.findMany({
      where: { businessId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.order.findMany({
      where: { businessId, status: "confirmed", total: { gt: 0 } },
      select: {
        id: true,
        total: true,
        payments: { where: { status: "paid" }, select: { amount: true } },
        customer: { select: { id: true, name: true, phone: true } },
      },
      take: 500,
    }),
    db.payment.aggregate({
      where: { businessId, status: "paid", paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    db.lead.count({
      where: { businessId, ...(openStageIds.length > 0 ? { stage: { in: openStageIds } } : {}) },
    }),
    db.order.count({
      where: { businessId, status: { in: [...ACTIVE_ORDER_STATUSES] } },
    }),
    db.appointment.count({
      where: { businessId, date: { gte: todayStart }, service: { type: "training" } },
    }),
    db.appointment.count({
      where: { businessId, date: { gte: todayStart }, service: { type: "grooming" } },
    }),
    db.boardingStay.count({
      where: { businessId, status: { in: ["reserved", "checked_in"] } },
    }),
    db.appointment.groupBy({
      by: ["serviceId"],
      where: {
        businessId,
        date: { gte: monthStart },
        status: { not: "canceled" },
        serviceId: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 1,
    }),
    db.order.findMany({
      where: { businessId },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.task.findMany({
      where: {
        businessId,
        status: { not: "COMPLETED" },
        OR: [
          { dueDate: { gte: todayStart, lte: todayEnd } },
          { dueAt: { gte: todayStart, lte: todayEnd } },
        ],
      },
      orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
      take: 10,
    }),
    db.task.findMany({
      where: {
        businessId,
        status: { not: "COMPLETED" },
        OR: [{ dueDate: { lt: todayStart } }, { dueAt: { lt: todayStart } }],
      },
      orderBy: [{ dueAt: "asc" }, { dueDate: "asc" }],
      take: 10,
    }),
    db.lead.findMany({
      where: {
        businessId,
        followUpStatus: "pending",
        nextFollowUpAt: { lte: todayEnd },
      },
      include: { customer: { select: { name: true } } },
      orderBy: { nextFollowUpAt: "asc" },
      take: 15,
    }),
    db.booking.count({ where: { businessId, status: "pending" } }),
    db.boardingStay.findMany({
      where: { businessId, status: "reserved", checkIn: { gte: todayStart, lte: todayEnd } },
      include: {
        pet: { select: { id: true, name: true, species: true } },
        customer: { select: { id: true, name: true, phone: true } },
        room: { select: { name: true } },
      },
      orderBy: { checkIn: "asc" },
      take: 10,
    }),
    db.boardingStay.findMany({
      where: { businessId, status: "checked_in", checkOut: { gte: todayStart, lte: todayEnd } },
      include: {
        pet: { select: { id: true, name: true, species: true } },
        customer: { select: { id: true, name: true, phone: true } },
        room: { select: { name: true } },
      },
      orderBy: { checkOut: "asc" },
      take: 10,
    }),
    db.appointment.findMany({
      where: { businessId, date: { gte: tomorrowStart, lte: tomorrowEnd }, status: "scheduled" },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        pet: { select: { name: true } },
        service: { select: { name: true } },
      },
      orderBy: { startTime: "asc" },
    }),
    db.customer.findMany({
      where: {
        businessId,
        appointments: {
          none: { date: { gte: sixtyDaysAgo } },
          some: {},
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        appointments: { select: { date: true }, orderBy: { date: "desc" }, take: 1 },
        _count: { select: { appointments: true } },
      },
      take: 30,
    }),
    db.pet.findMany({
      where: {
        OR: [{ customer: { businessId } }, { businessId }],
        birthDate: { not: null },
      },
      select: {
        id: true,
        name: true,
        species: true,
        breed: true,
        birthDate: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
      take: 300,
    }),
    db.payment.aggregate({
      where: { businessId, status: "paid", paidAt: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
    }),
    db.payment.findMany({
      where: { businessId, status: "paid", paidAt: { gte: sixMonthsStart } },
      select: { paidAt: true, amount: true },
    }),
  ]);

  // Debtors map
  let pendingPaymentsCount = 0;
  let pendingPaymentsSum = 0;
  const debtorMap = new Map<string, { id: string; name: string; phone: string; total: number }>();
  for (const order of confirmedOrdersRaw) {
    const paid = order.payments.reduce((s, p) => s + p.amount, 0);
    const outstanding = order.total - paid;
    if (outstanding < 0.009) continue;
    pendingPaymentsCount++;
    pendingPaymentsSum += outstanding;
    const key = order.customer.id;
    const entry = debtorMap.get(key);
    if (entry) {
      entry.total += outstanding;
    } else {
      debtorMap.set(key, { ...order.customer, total: outstanding });
    }
  }
  const topDebtors = Array.from(debtorMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // At-risk customers
  const atRiskCustomers = atRiskRaw
    .filter((c) => c._count.appointments >= 2 && c.appointments.length > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      lastAppointment: c.appointments[0].date.toISOString(),
      daysSinceVisit: Math.floor((now.getTime() - c.appointments[0].date.getTime()) / (1000 * 60 * 60 * 24)),
      totalVisits: c._count.appointments,
    }))
    .sort((a, b) => b.daysSinceVisit - a.daysSinceVisit)
    .slice(0, 8);

  // Top service lookup
  let topService: { name: string; count: number } | null = null;
  if (topServiceResult.length > 0) {
    const topServiceId = topServiceResult[0].serviceId;
    const svcFromUpcoming = upcomingAppointments.find((a) => a.service?.id === topServiceId);
    const svcName = svcFromUpcoming?.service?.name;
    if (svcName) {
      topService = { name: svcName, count: topServiceResult[0]._count.id };
    } else if (topServiceId) {
      const svc = await db.service.findUnique({ where: { id: topServiceId }, select: { name: true } });
      if (svc) topService = { name: svc.name, count: topServiceResult[0]._count.id };
    }
  }

  // Upcoming birthdays
  const upcomingBirthdays = allPetsWithBirthdays
    .filter((pet) => {
      if (!pet.birthDate) return false;
      const bd = pet.birthDate;
      for (let i = 0; i <= 7; i++) {
        const check = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
        if (bd.getMonth() === check.getMonth() && bd.getDate() === check.getDate()) return true;
      }
      return false;
    })
    .map((pet) => {
      const bd = pet.birthDate!;
      const thisYearBd = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
      const daysUntil = Math.round(
        (thisYearBd.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
        (1000 * 60 * 60 * 24)
      );
      const age = now.getFullYear() - bd.getFullYear() - (daysUntil > 0 ? 1 : 0);
      return { id: pet.id, name: pet.name, species: pet.species, breed: pet.breed, daysUntil, age, customer: pet.customer };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const todayRevenue = todayRevenueAgg._sum.amount || 0;

  // Revenue by month (last 6 months)
  const revenueByMonth: { month: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const amount = sixMonthPayments
      .filter((p) => p.paidAt && p.paidAt >= mStart && p.paidAt < mEnd)
      .reduce((sum, p) => sum + p.amount, 0);
    revenueByMonth.push({ month: HEBREW_MONTHS[mStart.getMonth()], amount });
  }

  return {
    totalCustomers,
    totalPets,
    todayAppointments,
    monthRevenue: canSeeRevenueSummary ? (monthPayments._sum.amount || 0) : null,
    todayRevenue: canSeeRevenueSummary ? todayRevenue : null,
    upcomingAppointments,
    recentTasks,
    pendingPayments: pendingPaymentsCount,
    openLeads,
    activeOrders,
    pendingPaymentsAmount: canSeeRevenueSummary ? pendingPaymentsSum : null,
    upcomingByType: {
      training: upcomingTraining,
      grooming: upcomingGrooming,
      boarding: activeBoardingStays,
    },
    revenueByMonth: canSeeRevenueSummary ? revenueByMonth : [],
    revenueTarget: canSeeRevenueSummary ? 10000 : null,
    topService,
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderType: (o as any).orderType,
      status: o.status,
      total: o.total,
      customerName: o.customer.name,
      createdAt: o.createdAt.toISOString(),
    })),
    todayTasks,
    overdueTasks,
    urgentLeads,
    topDebtors,
    tomorrowAppointments: tomorrowAppointments.map((a) => ({
      id: a.id,
      startTime: a.startTime,
      customerName: a.customer.name,
      customerId: a.customer.id,
      customerPhone: a.customer.phone,
      petName: a.pet?.name ?? null,
      serviceName: a.service?.name ?? null,
    })),
    pendingBookings,
    atRiskCustomers,
    upcomingBirthdays,
    todayArrivals: todayArrivals.map((s) => ({
      id: s.id,
      checkIn: s.checkIn.toISOString(),
      checkOut: s.checkOut?.toISOString() ?? null,
      status: s.status,
      pet: s.pet,
      customer: s.customer,
      room: s.room,
    })),
    todayDepartures: todayDepartures.map((s) => ({
      id: s.id,
      checkIn: s.checkIn.toISOString(),
      checkOut: s.checkOut?.toISOString() ?? null,
      status: s.status,
      pet: s.pet,
      customer: s.customer,
      room: s.room,
    })),
  };
}

// ─── Analytics ────────────────────────────────────────────────────────────

/**
 * GET /api/analytics — contract `AnalyticsData` (src/lib/analytics-types.ts).
 * Pure computations live in src/lib/analytics-metrics.ts (unit-tested); this function only loads data.
 */
export async function getAnalytics(
  businessId: string,
  db: DbClient,
  opts: { period?: string; from?: string | null; to?: string | null; canSeeRevenue: boolean }
): Promise<AnalyticsData> {
  const { canSeeRevenue } = opts;
  const now = new Date();
  const range = resolveAnalyticsRange(opts.period, opts.from, opts.to, now);
  const { from: fromDate, to: toDate } = range;

  const inPeriod = { gte: fromDate, lte: toDate };
  const inPrevPeriod = { gte: range.prevFrom, lt: range.prevTo };

  // Finance: last 12 Israel months ending with the month of `to` + the same months a year earlier.
  const monthKeys = lastMonthKeys(12, toDate);
  const [lastY, lastM] = monthKeys[monthKeys.length - 1].split("-").map(Number);
  const monthlyFrom = israelDayStart(`${prevYearMonthKey(monthKeys[0])}-01`);
  const monthlyTo = israelDayStart(new Date(Date.UTC(lastY, lastM, 1)).toISOString().slice(0, 10));

  const leadStages = await db.leadStage.findMany({
    where: { businessId },
    select: { id: true, isWon: true, isLost: true },
  });
  const activeStageIds = leadStages.filter((s) => !s.isWon && !s.isLost).map((s) => s.id);
  const wonStageIds = leadStages.filter((s) => s.isWon).map((s) => s.id);
  const lostStageIds = leadStages.filter((s) => s.isLost).map((s) => s.id);
  const wonStageSet = new Set(wonStageIds);
  const lostStageSet = new Set(lostStageIds);

  const appointmentSelect = { date: true, startTime: true, endTime: true, status: true, customerId: true } as const;
  const petsWhere = { OR: [{ customer: { businessId } }, { businessId }] };

  const [
    totalCustomers,
    newCustomers,
    prevNewCustomers,
    periodAppointments,
    prevAppointments,
    periodPayments,
    prevRevenueAgg,
    prevPayers,
    openTasks,
    completedTasks,
    activeLeads,
    wonLeads,
    prevWonLeads,
    lostLeads,
    periodLeads,
    lostReasonGroups,
    attributionLeads,
    activePrograms,
    completedTrainingSessions,
    activeTrainingGroups,
    completedGroupSessions,
    trainingRevenueAgg,
    boardingStays,
    prevBoardingStays,
    overlappingStays,
    rooms,
    monthlyPayments,
    outstanding,
    speciesGroups,
    breedGroups,
  ] = await Promise.all([
    db.customer.count({ where: { businessId } }),
    db.customer.count({ where: { businessId, createdAt: inPeriod } }),
    db.customer.count({ where: { businessId, createdAt: inPrevPeriod } }),
    db.appointment.findMany({ where: { businessId, date: inPeriod }, select: appointmentSelect }),
    db.appointment.findMany({ where: { businessId, date: inPrevPeriod }, select: appointmentSelect }),
    // Every paid payment in the period — revenue, categories, methods, top customers, retention.
    db.payment.findMany({
      where: { businessId, status: "paid", paidAt: inPeriod },
      select: {
        amount: true,
        method: true,
        customerId: true,
        appointmentId: true,
        boardingStayId: true,
        orderId: true,
        appointment: { select: { service: { select: { name: true } }, priceListItem: { select: { name: true } } } },
        order: { select: { orderType: true } },
        customer: { select: { name: true, createdAt: true } },
      },
    }),
    db.payment.aggregate({ where: { businessId, status: "paid", paidAt: inPrevPeriod }, _sum: { amount: true } }),
    db.payment.groupBy({ by: ["customerId"], where: { businessId, status: "paid", paidAt: inPrevPeriod } }),
    db.task.count({ where: { businessId, status: "OPEN" } }),
    db.task.count({ where: { businessId, status: "COMPLETED", completedAt: inPeriod } }),
    db.lead.count({ where: { businessId, stage: { in: activeStageIds } } }),
    db.lead.count({ where: { businessId, stage: { in: wonStageIds }, wonAt: inPeriod } }),
    db.lead.count({ where: { businessId, stage: { in: wonStageIds }, wonAt: inPrevPeriod } }),
    db.lead.count({ where: { businessId, stage: { in: lostStageIds }, lostAt: inPeriod } }),
    db.lead.findMany({ where: { businessId, createdAt: inPeriod }, select: { source: true, stage: true, dealValue: true } }),
    db.lead.groupBy({ by: ["lostReasonCode"], where: { businessId, lostAt: inPeriod }, _count: { _all: true } }),
    // Traffic attribution — fixed 12-month window, independent of the selected period
    db.lead.findMany({
      where: { businessId, createdAt: { gte: attributionWindowStart(now) } },
      select: { createdAt: true, trafficSource: true, landingPage: true, wonAt: true },
    }),
    db.trainingProgram.count({ where: { businessId, status: "ACTIVE" } }),
    db.trainingProgramSession.count({ where: { program: { businessId }, status: "COMPLETED", sessionDate: inPeriod } }),
    db.trainingGroup.count({ where: { businessId, isActive: true } }),
    db.trainingGroupSession.count({ where: { trainingGroup: { businessId }, status: "COMPLETED", sessionDatetime: inPeriod } }),
    db.trainingProgram.aggregate({
      where: { businessId, status: { in: ["ACTIVE", "COMPLETED"] }, startDate: inPeriod },
      _sum: { price: true },
    }),
    db.boardingStay.count({ where: { businessId, checkIn: inPeriod, status: { notIn: BOARDING_CANCELED_STATUSES } } }),
    db.boardingStay.count({ where: { businessId, checkIn: inPrevPeriod, status: { notIn: BOARDING_CANCELED_STATUSES } } }),
    db.boardingStay.findMany({
      where: {
        businessId,
        status: { notIn: BOARDING_CANCELED_STATUSES },
        roomId: { not: null },
        checkIn: { lte: toDate },
        OR: [{ checkOut: null }, { checkOut: { gte: fromDate } }],
      },
      select: { checkIn: true, checkOut: true, roomId: true },
    }),
    db.room.findMany({ where: { businessId, isActive: true }, select: { id: true, capacity: true } }),
    canSeeRevenue
      ? db.payment.findMany({
          where: { businessId, status: "paid", paidAt: { gte: monthlyFrom, lt: monthlyTo } },
          select: { amount: true, paidAt: true },
        })
      : Promise.resolve([] as { amount: number; paidAt: Date | null }[]),
    canSeeRevenue ? computeOutstandingBalances(db, businessId) : Promise.resolve(null),
    db.pet.groupBy({ by: ["species"], where: petsWhere, _count: { _all: true } }),
    db.pet.groupBy({
      by: ["breed"],
      where: { ...petsWhere, breed: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { breed: "desc" } },
      take: 8,
    }),
  ]);

  // ── Appointments ──
  const apptStats = computeAppointmentStats(periodAppointments, now);
  const prevApptStats = computeAppointmentStats(prevAppointments, now);
  const apptCharts = buildAppointmentCharts(periodAppointments);

  // ── Revenue ──
  const revenue = buildRevenueBreakdown(periodPayments);
  const currentRevenue = revenue.total;
  const previousRevenue = prevRevenueAgg._sum.amount || 0;
  const payingCustomerIds = new Set(periodPayments.map((p) => p.customerId));

  const customerRevenueMap = new Map<string, { id: string; name: string; revenue: number; count: number }>();
  for (const p of periodPayments) {
    const entry = customerRevenueMap.get(p.customerId) ?? { id: p.customerId, name: p.customer.name, revenue: 0, count: 0 };
    entry.revenue += p.amount;
    entry.count += 1;
    customerRevenueMap.set(p.customerId, entry);
  }
  const topCustomers = Array.from(customerRevenueMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((c) => ({ ...c, revenue: Math.round(c.revenue * 100) / 100 }));

  // ── Retention: active (completed appointment / paid payment) in previous period → active again now ──
  const activeIds = (appts: { customerId: string; status: string }[], payers: Iterable<string>) => {
    const ids = new Set<string>(payers);
    for (const a of appts) if (isCompletedStatus(a.status)) ids.add(a.customerId);
    return ids;
  };
  const retention = computeRetention(
    activeIds(prevAppointments, prevPayers.map((p) => p.customerId)),
    activeIds(periodAppointments, payingCustomerIds),
  );

  // ── Boarding ──
  const occupancy = computeOccupancy(overlappingStays, rooms, fromDate, toDate, now);
  const boardingRevenue = revenue.byCategory.find((c) => c.category === "boarding")?.revenue ?? 0;

  // ── Leads ──
  const leadsBySource = buildLeadSourceRows(
    periodLeads.map((l) => ({
      key: l.source || "manual",
      isWon: wonStageSet.has(l.stage),
      isLost: lostStageSet.has(l.stage),
      dealValue: l.dealValue,
    })),
    canSeeRevenue,
  );
  const lostReasonMap = new Map<string, number>();
  for (const g of lostReasonGroups) {
    const code = g.lostReasonCode || "OTHER";
    lostReasonMap.set(code, (lostReasonMap.get(code) || 0) + g._count._all);
  }
  const lostReasons = Array.from(lostReasonMap.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);
  const leadAttribution = buildLeadAttributionReport(attributionLeads, now);

  // Lead sales — deal value of leads won in the period + orders their customers placed since closing.
  // Money → hidden like revenue for roles that can't see it. Never merged into "revenue".
  let leadSales: AnalyticsData["leadSales"] = null;
  if (canSeeRevenue) {
    const [wonPeriodLeads, pipelineAgg] = await Promise.all([
      db.lead.findMany({
        where: { businessId, stage: { in: wonStageIds }, wonAt: inPeriod },
        select: { id: true, name: true, wonAt: true, dealValue: true, customerId: true },
      }),
      db.lead.aggregate({
        where: { businessId, stage: { in: activeStageIds }, dealValue: { not: null } },
        _sum: { dealValue: true },
        _count: { _all: true },
      }),
    ]);
    const customerIds = Array.from(new Set(wonPeriodLeads.map((l) => l.customerId).filter((id): id is string => !!id)));
    const earliestWon = wonPeriodLeads.reduce<Date | null>(
      (min, l) => (l.wonAt && (!min || l.wonAt < min) ? l.wonAt : min),
      null,
    );
    const [customerOrders, ownerLeads] = customerIds.length > 0 && earliestWon
      ? await Promise.all([
          db.order.findMany({
            where: { businessId, customerId: { in: customerIds }, createdAt: { gte: earliestWon }, status: { notIn: EXCLUDED_ORDER_STATUSES } },
            select: { customerId: true, total: true, status: true, createdAt: true },
          }),
          // Every won lead of these customers (any date) — decides which closing owns each order
          db.lead.findMany({
            where: { businessId, customerId: { in: customerIds }, stage: { in: wonStageIds }, wonAt: { not: null } },
            select: { id: true, wonAt: true, customerId: true },
          }),
        ])
      : [[], []];
    leadSales = {
      ...buildLeadSalesReport(
        wonPeriodLeads.filter((l) => l.wonAt).map((l) => ({ ...l, wonAt: l.wonAt as Date })),
        customerOrders,
        undefined,
        ownerLeads.map((l) => ({ ...l, wonAt: l.wonAt as Date })),
      ),
      pipelineValue: Math.round((pipelineAgg._sum.dealValue ?? 0) * 100) / 100,
      pipelineWithValueCount: pipelineAgg._count._all,
    };
  }

  // ── Pets ──
  const petDemographics = {
    total: speciesGroups.reduce((s, g) => s + g._count._all, 0),
    bySpecies: speciesGroups
      .map((g) => ({ species: g.species, count: g._count._all }))
      .sort((a, b) => b.count - a.count),
    topBreeds: breedGroups
      .filter((g): g is typeof g & { breed: string } => !!g.breed)
      .map((g) => ({ breed: g.breed, count: g._count._all })),
  };

  // ── Finance (owner only) ──
  const finance: AnalyticsData["finance"] = canSeeRevenue
    ? {
        monthly: buildMonthlyRevenue(monthlyPayments, monthKeys, prevYearMonthKey),
        byCategory: revenue.byCategory,
        byMethod: buildRevenueByMethod(periodPayments),
        newVsReturning: splitNewVsReturning(
          periodPayments.map((p) => ({ amount: p.amount, customerCreatedAt: p.customer.createdAt })),
          fromDate,
          toDate,
        ),
        payingCustomers: payingCustomerIds.size,
        outstanding: {
          total: Math.round((outstanding?.grandTotal ?? 0) * 100) / 100,
          customers: outstanding?.rows.length ?? 0,
          top: (outstanding?.rows ?? []).slice(0, 5).map((r) => ({
            customerId: r.id,
            name: r.name,
            total: Math.round(r.total * 100) / 100,
            oldest: r.oldest.toISOString(),
          })),
        },
      }
    : null;

  return {
    period: range.period,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    overview: {
      totalCustomers,
      newCustomers,
      newCustomersChange: pctChange(newCustomers, prevNewCustomers),
      totalAppointments: apptStats.total,
      appointmentsChange: pctChange(apptStats.total, prevApptStats.total),
      completedAppointments: apptStats.completed,
      canceledAppointments: apptStats.canceled,
      noShowAppointments: apptStats.noShow,
      completionRate: apptStats.completionRate,
      completionRateChange:
        apptStats.due > 0 && prevApptStats.due > 0 ? apptStats.completionRate - prevApptStats.completionRate : null,
      cancellationRate: apptStats.cancellationRate,
      noShowRate: apptStats.noShowRate,
      revenue: canSeeRevenue ? currentRevenue : null,
      revenueChange: canSeeRevenue ? pctChange(currentRevenue, previousRevenue) : null,
      paymentCount: canSeeRevenue ? periodPayments.length : null,
    },
    tasks: { open: openTasks, completedThisPeriod: completedTasks },
    leads: {
      active: activeLeads,
      wonThisPeriod: wonLeads,
      lostThisPeriod: lostLeads,
      conversionRate: pct(wonLeads, wonLeads + lostLeads) ?? 0,
      wonChange: pctChange(wonLeads, prevWonLeads),
    },
    leadsBySource,
    lostReasons,
    leadAttribution,
    leadSales,
    training: {
      activePrograms,
      completedSessionsThisPeriod: completedTrainingSessions,
      activeGroups: activeTrainingGroups,
      groupSessionsThisPeriod: completedGroupSessions,
      revenue: canSeeRevenue ? (trainingRevenueAgg._sum.price || 0) : null,
    },
    boarding: {
      staysThisPeriod: boardingStays,
      staysChange: pctChange(boardingStays, prevBoardingStays),
      occupiedNights: occupancy.occupiedNights,
      capacityNights: occupancy.capacityNights,
      occupancyRate: occupancy.occupancyRate,
      revenue: canSeeRevenue ? boardingRevenue : null,
    },
    finance,
    charts: {
      appointmentsByDate: apptCharts.appointmentsByDate,
      revenueByService: canSeeRevenue ? revenue.revenueByService : [],
      appointmentsByDayOfWeek: apptCharts.appointmentsByDayOfWeek,
      appointmentsByHour: apptCharts.appointmentsByHour,
    },
    topCustomers: canSeeRevenue ? topCustomers : [],
    petDemographics,
    retention: {
      ...retention,
      avgRevenuePerCustomer: canSeeRevenue ? avgRevenuePerPayingCustomer(currentRevenue, payingCustomerIds.size) : null,
    },
  };
}

// ─── Business Admin ────────────────────────────────────────────────────────

/** Fields of an ActivityLog row returned to the business owner (no extra columns). */
const ACTIVITY_SELECT = {
  id: true,
  userId: true,
  userName: true,
  action: true,
  createdAt: true,
  entityType: true,
  entityId: true,
  entityLabel: true,
} as const;

/**
 * Tenant rule for ActivityLog: rows written for this business, plus legacy rows
 * (businessId IS NULL, written before 2026-10) by users who are members of it.
 */
async function activityTenantWhere(businessId: string, db: DbClient) {
  const businessUsers = await db.businessUser.findMany({
    where: { businessId },
    select: { userId: true },
  });
  const memberIds = businessUsers.map((bu) => bu.userId);
  const where: Prisma.ActivityLogWhereInput = {
    OR: [{ businessId }, { businessId: null, userId: { in: memberIds } }],
  };
  return { where, memberIds };
}

export async function getBusinessOverview(businessId: string, db: DbClient) {
  // Israel-time boundaries (server runs in UTC on Vercel) — see business-admin-activity.ts
  const { apptDayStart, apptDayEnd, monthStart } = israelOverviewBoundaries();
  const { where: activityWhere } = await activityTenantWhere(businessId, db);

  const [teamCount, customerCount, todayAppts, monthlyRevenue, recentActivity] = await Promise.all([
    db.businessUser.count({ where: { businessId, isActive: true } }),
    db.customer.count({ where: { businessId } }),
    db.appointment.count({
      where: { businessId, date: { gte: apptDayStart, lt: apptDayEnd }, status: { notIn: ["canceled", "cancelled"] } },
    }),
    db.payment.aggregate({
      where: { businessId, paidAt: { gte: monthStart }, status: "paid" },
      _sum: { amount: true },
    }),
    db.activityLog.findMany({
      where: activityWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 15,
      select: ACTIVITY_SELECT,
    }),
  ]);

  return {
    teamCount,
    customerCount,
    todayAppts,
    monthlyRevenue: monthlyRevenue._sum.amount ?? 0,
    recentActivity,
  };
}

/** Build the filtered ActivityLog where clause; null = filter can match nothing. */
async function buildActivityWhere(
  businessId: string,
  db: DbClient,
  filters: ActivityQuery
): Promise<Prisma.ActivityLogWhereInput | null> {
  const { where: tenant, memberIds } = await activityTenantWhere(businessId, db);
  // A userId that isn't a member of this business matches nothing.
  if (filters.userId && !memberIds.includes(filters.userId)) return null;

  const and: Prisma.ActivityLogWhereInput[] = [tenant];
  if (filters.userId) and.push({ userId: filters.userId });
  if (filters.action) and.push({ action: filters.action });
  if (filters.gte || filters.lt) {
    and.push({ createdAt: { ...(filters.gte ? { gte: filters.gte } : {}), ...(filters.lt ? { lt: filters.lt } : {}) } });
  }
  if (filters.q) {
    and.push({
      OR: [
        { userName: { contains: filters.q, mode: "insensitive" } },
        { entityLabel: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }
  return { AND: and };
}

/**
 * Activity log page for the business owner — keyset pagination on
 * (createdAt desc, id desc). Filters are pre-validated by parseActivityQuery().
 */
export async function getBusinessActivity(businessId: string, db: DbClient, filters: ActivityQuery) {
  const where = await buildActivityWhere(businessId, db, filters);
  if (!where) return { items: [], nextCursor: null as string | null };
  const take = Math.min(Math.max(filters.take, 1), ACTIVITY_PAGE_MAX);
  const rows = await db.activityLog.findMany({
    where: filters.cursor ? { AND: [where, keysetAfter(filters.cursor)] } : where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: ACTIVITY_SELECT,
  });
  return paginate(rows, take);
}

/** All activity rows matching the filters (cursor/take ignored), capped at ACTIVITY_EXPORT_MAX_ROWS. */
export async function getBusinessActivityForExport(businessId: string, db: DbClient, filters: ActivityQuery) {
  const where = await buildActivityWhere(businessId, db, filters);
  if (!where) return [];
  return db.activityLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: ACTIVITY_EXPORT_MAX_ROWS,
    select: ACTIVITY_SELECT,
  });
}

/**
 * AI (MCP) tool-call feed for the business owner: McpAuditLog rows of this
 * business's connections, last AI_ACTIVITY_WINDOW_DAYS days. Never returns
 * params / token hashes.
 */
export async function getBusinessAiActivity(
  businessId: string,
  db: DbClient,
  opts: AiActivityQuery & { includeConnections?: boolean }
) {
  const take = Math.min(Math.max(opts.take, 1), ACTIVITY_PAGE_MAX);
  const since = new Date(Date.now() - AI_ACTIVITY_WINDOW_DAYS * 86_400_000);

  const and: Prisma.McpAuditLogWhereInput[] = [
    { connection: { businessId } },
    { createdAt: { gte: since } },
  ];
  if (opts.connectionId) and.push({ connectionId: opts.connectionId });
  if (opts.status) and.push({ status: opts.status });
  if (opts.cursor) and.push(keysetAfter(opts.cursor));

  const [rows, connections] = await Promise.all([
    db.mcpAuditLog.findMany({
      where: { AND: and },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      select: {
        id: true,
        createdAt: true,
        toolName: true,
        status: true,
        resultSummary: true,
        errorMessage: true,
        connection: { select: { id: true, name: true, createdByUserId: true, oauthClientId: true } },
      },
    }),
    opts.includeConnections
      ? db.mcpConnection.findMany({
          where: { businessId },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: { id: true, name: true, revokedAt: true },
        })
      : Promise.resolve(null),
  ]);

  const page = paginate(rows, take);
  const creatorIds = Array.from(
    new Set(page.items.map((r) => r.connection.createdByUserId).filter((x): x is string => !!x))
  );
  const creators = creatorIds.length
    ? await db.platformUser.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(creators.map((u) => [u.id, u.name]));

  return {
    items: page.items.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      toolName: cleanText(r.toolName, 80) ?? "",
      status: r.status,
      resultSummary: cleanText(r.resultSummary),
      errorMessage: r.status === "error" || r.status === "denied" ? cleanText(r.errorMessage) : null,
      connection: {
        id: r.connection.id,
        name: cleanText(r.connection.name, 80) ?? "",
        createdByName: r.connection.createdByUserId
          ? cleanText(nameById.get(r.connection.createdByUserId), 80)
          : null,
        oauth: r.connection.oauthClientId != null,
      },
    })),
    nextCursor: page.nextCursor,
    ...(connections
      ? {
          connections: connections.map((c) => ({
            id: c.id,
            name: cleanText(c.name, 80) ?? "",
            revoked: c.revokedAt != null,
          })),
        }
      : {}),
  };
}

export async function getActiveBusinessSessions(businessId: string, db: DbClient) {
  const businessUsers = await db.businessUser.findMany({
    where: { businessId },
    select: { userId: true, role: true },
  });
  const bizUserIds = businessUsers.map((bu) => bu.userId);
  const roleMap = Object.fromEntries(businessUsers.map((bu) => [bu.userId, bu.role]));

  const sessions = await db.adminSession.findMany({
    where: {
      userId: { in: bizUserIds },
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      userId: true,
      userAgent: true,
      ipAddress: true,
      lastSeenAt: true,
      createdAt: true,
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { lastSeenAt: "desc" },
  });

  return sessions.map((s) => ({ ...s, businessRole: roleMap[s.userId] ?? "user" }));
}

export async function listTeamMembers(businessId: string, db: DbClient) {
  return db.businessUser.findMany({
    where: { businessId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          createdAt: true,
          isActive: true,
          sessions: {
            where: { expiresAt: { gt: new Date() } },
            orderBy: { lastSeenAt: "desc" },
            take: 1,
            select: { lastSeenAt: true, userAgent: true, createdAt: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateTeamMember(
  businessId: string,
  db: DbClient,
  memberId: string,
  data: { role?: string; isActive?: boolean },
  currentUserId: string
) {
  const existing = await db.businessUser.findFirst({
    where: { id: memberId, businessId },
  });
  if (!existing) throw new ServiceError("Member not found", "NOT_FOUND");
  if (existing.userId === currentUserId) {
    throw new ServiceError("Cannot modify your own account", "VALIDATION");
  }

  const update: Record<string, unknown> = {};
  if (data.role !== undefined && ["owner", "manager", "user"].includes(data.role)) {
    update.role = data.role;
  }
  if (data.isActive !== undefined) update.isActive = Boolean(data.isActive);

  const updated = await db.businessUser.update({
    where: { id: memberId },
    data: update as any,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (update.isActive === false) {
    await db.adminSession.deleteMany({ where: { userId: existing.userId } });
  }

  return updated;
}

// ─── Onboarding ───────────────────────────────────────────────────────────

export async function getOnboardingProgress(
  userId: string,
  businessId: string | null,
  db: DbClient
) {
  const progress = await db.onboardingProgress.findUnique({ where: { userId } });
  if (!progress) return { progress: null };

  const [
    servicesCount,
    customersCount,
    appointmentsCount,
    ordersCount,
    contractTemplatesCount,
    business,
  ] = await Promise.all([
    businessId
      ? db.service.count({ where: { businessId, isActive: true } })
      : Promise.resolve(0),
    businessId
      ? db.customer.count({ where: { businessId } })
      : Promise.resolve(0),
    businessId
      ? db.appointment.count({ where: { service: { businessId } } })
      : Promise.resolve(0),
    businessId
      ? db.order.count({ where: { businessId } })
      : Promise.resolve(0),
    businessId
      ? db.contractTemplate.count({ where: { businessId } })
      : Promise.resolve(0),
    businessId
      ? db.business.findUnique({
          where: { id: businessId },
          select: { phone: true, whatsappRemindersEnabled: true },
        })
      : Promise.resolve(null),
  ]);

  const businessComplete = !!business?.phone;

  const enriched = {
    ...progress,
    stepCompleted1: progress.stepCompleted1 || businessComplete,
    stepCompleted2: progress.stepCompleted2 || servicesCount > 0,
    stepCompleted3: progress.stepCompleted3 || customersCount > 0,
    stepCompleted4: progress.stepCompleted4 || appointmentsCount > 0,
    stepCompleted5: ordersCount > 0,
    stepCompleted6: contractTemplatesCount > 0,
    stepCompleted7: business?.whatsappRemindersEnabled === true,
  };

  const allDone =
    enriched.stepCompleted1 &&
    enriched.stepCompleted2 &&
    enriched.stepCompleted3 &&
    enriched.stepCompleted4 &&
    enriched.stepCompleted5 &&
    enriched.stepCompleted6 &&
    enriched.stepCompleted7;

  if (allDone && !progress.completedAt) {
    await db.onboardingProgress.update({
      where: { userId },
      data: {
        stepCompleted1: enriched.stepCompleted1,
        stepCompleted2: enriched.stepCompleted2,
        stepCompleted3: enriched.stepCompleted3,
        stepCompleted4: enriched.stepCompleted4,
        completedAt: new Date(),
      },
    });
    return { progress: { ...enriched, completedAt: new Date().toISOString() } };
  }

  if (
    enriched.stepCompleted1 !== progress.stepCompleted1 ||
    enriched.stepCompleted2 !== progress.stepCompleted2 ||
    enriched.stepCompleted3 !== progress.stepCompleted3 ||
    enriched.stepCompleted4 !== progress.stepCompleted4
  ) {
    await db.onboardingProgress.update({
      where: { userId },
      data: {
        stepCompleted1: enriched.stepCompleted1,
        stepCompleted2: enriched.stepCompleted2,
        stepCompleted3: enriched.stepCompleted3,
        stepCompleted4: enriched.stepCompleted4,
      },
    });
  }

  return { progress: enriched };
}

export async function updateOnboardingProgress(
  userId: string,
  db: DbClient,
  data: {
    skipped?: boolean;
    completedAt?: string;
    startedAt?: string;
    stepCompleted1?: boolean;
    stepCompleted2?: boolean;
    stepCompleted3?: boolean;
    stepCompleted4?: boolean;
  }
) {
  const {
    skipped, completedAt, startedAt,
    stepCompleted1, stepCompleted2, stepCompleted3, stepCompleted4,
  } = data;

  const progress = await db.onboardingProgress.upsert({
    where: { userId },
    create: {
      userId,
      currentStep: 0,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      ...(skipped !== undefined && { skipped }),
      ...(completedAt !== undefined && { completedAt: new Date(completedAt) }),
      ...(stepCompleted1 !== undefined && { stepCompleted1 }),
      ...(stepCompleted2 !== undefined && { stepCompleted2 }),
      ...(stepCompleted3 !== undefined && { stepCompleted3 }),
      ...(stepCompleted4 !== undefined && { stepCompleted4 }),
    },
    update: {
      ...(skipped !== undefined && { skipped }),
      ...(completedAt !== undefined && { completedAt: new Date(completedAt) }),
      ...(startedAt !== undefined && { startedAt: new Date(startedAt) }),
      ...(stepCompleted1 !== undefined && { stepCompleted1 }),
      ...(stepCompleted2 !== undefined && { stepCompleted2 }),
      ...(stepCompleted3 !== undefined && { stepCompleted3 }),
      ...(stepCompleted4 !== undefined && { stepCompleted4 }),
    },
  });

  return { progress };
}
