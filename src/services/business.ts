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

import type { DbClient } from "./supabase";
import { ServiceError } from "./types";
import { validateIsraeliPhone, validateEmail } from "@/lib/validation";

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
  customerTags?: string[];
  cancellationPolicy?: string;
  bookingWelcomeText?: string;
  depositInstructions?: string;
  sdSettings?: unknown;
  whatsappRemindersEnabled?: boolean;
  whatsappReminderLeadHours?: number;
  googleContactsSync?: boolean;
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
    customerTags, cancellationPolicy, bookingWelcomeText, depositInstructions,
    sdSettings, whatsappRemindersEnabled, whatsappReminderLeadHours, googleContactsSync,
  } = input;

  // ── Validation ─────────────────────────────────────────────────────────
  if (logo !== undefined) {
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
  if (phone !== undefined && phone !== null) {
    if (typeof phone !== "string" || !validateIsraeliPhone(String(phone))) {
      throw new ServiceError("מספר טלפון לא תקין", "VALIDATION");
    }
  }
  if (email !== undefined && email !== null) {
    if (typeof email !== "string" || email.length > 254 || !validateEmail(email)) {
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
  if (customerTags !== undefined) {
    if (
      !Array.isArray(customerTags) ||
      customerTags.length > 100 ||
      customerTags.some((t: unknown) => typeof t !== "string" || t.length > 50)
    ) {
      throw new ServiceError("תגיות לקוח לא תקינות (מקסימום 100 תגיות, 50 תווים לכל אחת)", "VALIDATION");
    }
  }

  const VALID_LEGAL_ENTITY_TYPES = ["עוסק פטור", "עוסק מורשה", "חברה"];
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
  if (customerTags !== undefined) data.customerTags = customerTags;
  if (cancellationPolicy !== undefined) data.cancellationPolicy = cancellationPolicy;
  if (bookingWelcomeText !== undefined) data.bookingWelcomeText = bookingWelcomeText;
  if (depositInstructions !== undefined) data.depositInstructions = depositInstructions;
  if (sdSettings !== undefined) data.sdSettings = sdSettings;
  if (whatsappRemindersEnabled !== undefined) data.whatsappRemindersEnabled = Boolean(whatsappRemindersEnabled);
  if (whatsappReminderLeadHours !== undefined) data.whatsappReminderLeadHours = whatsappReminderLeadHours;
  if (googleContactsSync !== undefined) data.googleContactsSync = Boolean(googleContactsSync);

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
  opts: { canSeeRevenueSummary: boolean }
) {
  const { canSeeRevenueSummary } = opts;

  const IL_TZ = "Asia/Jerusalem";
  const now = new Date();
  const ilFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: IL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [ilYear, ilMonth, ilDay] = ilFormatter.format(now).split("-").map(Number);
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
      where: { businessId, status: { in: ["draft", "confirmed"] } },
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

export async function getAnalytics(
  businessId: string,
  db: DbClient,
  opts: { period?: string; from?: string | null; to?: string | null; canSeeRevenue: boolean }
) {
  const { period = "month", from: fromParam, to: toParam, canSeeRevenue } = opts;

  const now = new Date();
  let fromDate: Date;
  let toDate: Date = now;

  if (fromParam && toParam) {
    fromDate = new Date(fromParam);
    toDate = new Date(toParam);
    toDate.setHours(23, 59, 59, 999);
  } else {
    switch (period) {
      case "week":
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  const periodLength = toDate.getTime() - fromDate.getTime();
  const prevFrom = new Date(fromDate.getTime() - periodLength);
  const prevTo = fromDate;

  const inPeriod = { gte: fromDate, lte: toDate };
  const inPrevPeriod = { gte: prevFrom, lt: prevTo };

  const leadStages = await db.leadStage.findMany({ where: { businessId } });
  const activeStageIds = leadStages.filter((s) => !s.isWon && !s.isLost).map((s) => s.id);
  const wonStageIds = leadStages.filter((s) => s.isWon).map((s) => s.id);
  const lostStageIds = leadStages.filter((s) => s.isLost).map((s) => s.id);

  const [
    totalCustomers,
    newCustomers,
    prevNewCustomers,
    totalAppointments,
    prevAppointments,
    completedAppointments,
    canceledAppointments,
    totalPayments,
    prevPayments,
    openTasks,
    completedTasks,
    activeLeads,
    wonLeads,
    lostLeads,
    activePrograms,
    completedTrainingSessions,
    activeTrainingGroups,
    completedGroupSessions,
    trainingRevenueAgg,
    boardingStays,
    appointmentsByDate,
  ] = await Promise.all([
    db.customer.count({ where: { businessId } }),
    db.customer.count({ where: { businessId, createdAt: inPeriod } }),
    db.customer.count({ where: { businessId, createdAt: inPrevPeriod } }),
    db.appointment.count({ where: { businessId, date: inPeriod } }),
    db.appointment.count({ where: { businessId, date: inPrevPeriod } }),
    db.appointment.count({ where: { businessId, date: inPeriod, status: { in: ["completed", "COMPLETED"] } } }),
    db.appointment.count({ where: { businessId, date: inPeriod, status: "canceled" } }),
    db.payment.aggregate({ where: { businessId, status: "paid", paidAt: inPeriod }, _sum: { amount: true }, _count: true }),
    db.payment.aggregate({ where: { businessId, status: "paid", paidAt: inPrevPeriod }, _sum: { amount: true } }),
    db.task.count({ where: { businessId, status: "OPEN" } }),
    db.task.count({ where: { businessId, status: "COMPLETED", completedAt: inPeriod } }),
    db.lead.count({ where: { businessId, stage: { in: activeStageIds } } }),
    db.lead.count({ where: { businessId, stage: { in: wonStageIds }, wonAt: inPeriod } }),
    db.lead.count({ where: { businessId, stage: { in: lostStageIds }, lostAt: inPeriod } }),
    db.trainingProgram.count({ where: { businessId, status: "ACTIVE" } }),
    db.trainingProgramSession.count({ where: { program: { businessId }, status: "COMPLETED", sessionDate: inPeriod } }),
    db.trainingGroup.count({ where: { businessId, isActive: true } }),
    db.trainingGroupSession.count({ where: { trainingGroup: { businessId }, status: "COMPLETED", sessionDatetime: inPeriod } }),
    db.trainingProgram.aggregate({
      where: { businessId, status: { in: ["ACTIVE", "COMPLETED"] }, startDate: inPeriod },
      _sum: { price: true },
    }),
    db.boardingStay.count({ where: { businessId, checkIn: inPeriod } }),
    db.appointment.groupBy({
      by: ["date"],
      where: { businessId, date: inPeriod },
      _count: true,
      orderBy: { date: "asc" },
    }),
  ]);

  const currentRevenue = totalPayments._sum.amount || 0;
  const previousRevenue = prevPayments._sum.amount || 0;

  // Day-of-week and hour heatmap
  const allAppointments = await db.appointment.findMany({
    where: { businessId, date: inPeriod },
    select: { date: true, startTime: true },
  });

  const dayLabels = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const byDayOfWeek = Array.from({ length: 7 }, (_, i) => ({ day: dayLabels[i], count: 0 }));
  const byHour: Record<number, number> = {};
  for (const a of allAppointments) {
    const dow = new Date(a.date).getDay();
    byDayOfWeek[dow].count += 1;
    const hour = parseInt(a.startTime.split(":")[0], 10);
    if (!isNaN(hour)) byHour[hour] = (byHour[hour] || 0) + 1;
  }
  const appointmentsByHour = Object.entries(byHour)
    .map(([h, count]) => ({ hour: parseInt(h, 10), label: `${h}:00`, count }))
    .sort((a, b) => a.hour - b.hour);

  // Top customers
  const topCustomerPayments = await db.payment.findMany({
    where: { businessId, status: "paid", paidAt: inPeriod },
    select: { amount: true, customer: { select: { id: true, name: true } } },
  });
  const customerRevenueMap = new Map<string, { id: string; name: string; revenue: number; count: number }>();
  for (const p of topCustomerPayments) {
    const key = p.customer.id;
    if (!customerRevenueMap.has(key)) {
      customerRevenueMap.set(key, { id: p.customer.id, name: p.customer.name, revenue: 0, count: 0 });
    }
    const entry = customerRevenueMap.get(key)!;
    entry.revenue += p.amount;
    entry.count += 1;
  }
  const topCustomers = Array.from(customerRevenueMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Revenue by service
  const servicePayments = await db.payment.findMany({
    where: { businessId, status: "paid", paidAt: inPeriod, appointmentId: { not: null } },
    select: { amount: true, appointment: { select: { service: { select: { name: true } } } } },
  });
  const serviceRevenueMap = new Map<string, { name: string; revenue: number }>();
  for (const p of servicePayments) {
    const serviceName = p.appointment?.service?.name;
    if (!serviceName) continue;
    if (!serviceRevenueMap.has(serviceName)) serviceRevenueMap.set(serviceName, { name: serviceName, revenue: 0 });
    serviceRevenueMap.get(serviceName)!.revenue += p.amount;
  }
  const revenueByService = Array.from(serviceRevenueMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Retention
  const allCustomerAppointments = await db.appointment.groupBy({
    by: ["customerId"],
    where: { businessId },
    _count: true,
  });
  const returningCustomers = allCustomerAppointments.filter((c) => c._count > 1).length;
  const customersWithAppointments = allCustomerAppointments.length;
  const retentionRate =
    customersWithAppointments > 0
      ? Math.round((returningCustomers / customersWithAppointments) * 100)
      : 0;
  const avgRevenuePerCustomer =
    totalCustomers > 0 ? Math.round((currentRevenue / totalCustomers) * 100) / 100 : 0;

  // Pet demographics
  const allPets = await db.pet.findMany({
    where: {
      OR: [{ customer: { businessId } }, { businessId }],
    },
    select: { species: true, breed: true },
  });
  const speciesCount: Record<string, number> = {};
  const breedCount: Record<string, number> = {};
  for (const pet of allPets) {
    speciesCount[pet.species] = (speciesCount[pet.species] || 0) + 1;
    if (pet.breed) breedCount[pet.breed] = (breedCount[pet.breed] || 0) + 1;
  }
  const petDemographics = {
    total: allPets.length,
    bySpecies: Object.entries(speciesCount)
      .map(([species, count]) => ({ species, count }))
      .sort((a, b) => b.count - a.count),
    topBreeds: Object.entries(breedCount)
      .map(([breed, count]) => ({ breed, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  };

  const calcChange = (current: number, previous: number): number | null => {
    if (previous === 0) return current > 0 ? null : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  return {
    period,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    overview: {
      totalCustomers,
      newCustomers,
      newCustomersChange: calcChange(newCustomers, prevNewCustomers),
      totalAppointments,
      appointmentsChange: calcChange(totalAppointments, prevAppointments),
      completedAppointments,
      canceledAppointments,
      completionRate:
        totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0,
      revenue: canSeeRevenue ? currentRevenue : null,
      revenueChange: canSeeRevenue ? calcChange(currentRevenue, previousRevenue) : null,
      paymentCount: canSeeRevenue ? totalPayments._count : null,
    },
    tasks: { open: openTasks, completedThisPeriod: completedTasks },
    leads: {
      active: activeLeads,
      wonThisPeriod: wonLeads,
      lostThisPeriod: lostLeads,
      conversionRate:
        wonLeads + lostLeads > 0 ? Math.round((wonLeads / (wonLeads + lostLeads)) * 100) : 0,
    },
    training: {
      activePrograms,
      completedSessionsThisPeriod: completedTrainingSessions,
      activeGroups: activeTrainingGroups,
      groupSessionsThisPeriod: completedGroupSessions,
      revenue: canSeeRevenue ? (trainingRevenueAgg._sum.price || 0) : null,
    },
    boarding: { staysThisPeriod: boardingStays },
    charts: {
      appointmentsByDate: appointmentsByDate.map((a) => ({ date: a.date, count: a._count })),
      revenueByService: canSeeRevenue ? revenueByService : [],
      appointmentsByDayOfWeek: byDayOfWeek,
      appointmentsByHour,
    },
    topCustomers: canSeeRevenue ? topCustomers : [],
    petDemographics,
    retention: {
      returningCustomers,
      customersWithAppointments,
      retentionRate,
      avgRevenuePerCustomer: canSeeRevenue ? avgRevenuePerCustomer : null,
    },
  };
}

// ─── Business Admin ────────────────────────────────────────────────────────

export async function getBusinessOverview(businessId: string, db: DbClient) {
  const businessUsers = await db.businessUser.findMany({
    where: { businessId },
    select: { userId: true },
  });
  const userIds = businessUsers.map((bu) => bu.userId);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [teamCount, customerCount, todayAppts, monthlyRevenue, recentActivity] = await Promise.all([
    db.businessUser.count({ where: { businessId, isActive: true } }),
    db.customer.count({ where: { businessId } }),
    db.appointment.count({
      where: { businessId, date: { gte: todayStart, lt: todayEnd }, status: { not: "cancelled" } },
    }),
    db.payment.aggregate({
      where: { businessId, paidAt: { gte: monthStart }, status: "paid" },
      _sum: { amount: true },
    }),
    db.activityLog.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: "desc" },
      take: 15,
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

export async function getBusinessActivity(
  businessId: string,
  db: DbClient,
  opts: { userId?: string | null; action?: string | null; take?: number } = {}
) {
  const { userId: filterUserId, action: filterAction, take = 50 } = opts;
  const clampedTake = Math.min(take, 100);

  const businessUsers = await db.businessUser.findMany({
    where: { businessId },
    select: { userId: true },
  });
  const bizUserIds = businessUsers.map((bu) => bu.userId);

  const resolvedUserId =
    filterUserId && bizUserIds.includes(filterUserId) ? filterUserId : undefined;

  const where: Record<string, unknown> = {
    userId: resolvedUserId ? resolvedUserId : { in: bizUserIds },
  };
  if (filterAction) where.action = filterAction;

  return db.activityLog.findMany({
    where: where as any,
    orderBy: { createdAt: "desc" },
    take: clampedTake,
  });
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
