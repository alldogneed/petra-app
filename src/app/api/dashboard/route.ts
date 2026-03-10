export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { businessId } = authResult;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Get open lead stage IDs (not won and not lost) for this business
    const openStages = await prisma.leadStage.findMany({
      where: { businessId, isWon: false, isLost: false },
      select: { id: true },
    });
    const openStageIds = openStages.map(s => s.id);

    const [
      totalCustomers,
      totalPets,
      todayAppointments,
      upcomingAppointments,
      recentTasks,
      pendingPayments,
      monthPayments,
      openLeads,
      activeOrders,
      pendingPaymentsAmount,
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
      pendingPaymentRows,
      atRiskRaw,
      allPetsWithBirthdays,
      todayRevenueAgg,
      sixMonthPayments,
    ] = await Promise.all([
      prisma.customer.count({ where: { businessId } }),
      prisma.pet.count({ where: { customer: { businessId } } }),
      prisma.appointment.count({
        where: { businessId, date: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.appointment.findMany({
        where: {
          businessId,
          date: { gte: todayStart },
          status: "scheduled",
        },
        include: {
          customer: { select: { name: true, phone: true } },
          pet: { select: { name: true, species: true } },
          service: { select: { id: true, name: true, color: true, type: true } },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 8,
      }),
      prisma.task.findMany({
        where: { businessId, status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.payment.count({
        where: { businessId, status: "pending" },
      }),
      prisma.payment.aggregate({
        where: {
          businessId,
          status: "paid",
          paidAt: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
      prisma.lead.count({
        where: { businessId, ...(openStageIds.length > 0 ? { stage: { in: openStageIds } } : {}) },
      }),
      prisma.order.count({
        where: { businessId, status: { in: ["draft", "confirmed"] } },
      }),
      prisma.payment.aggregate({
        where: { businessId, status: "pending" },
        _sum: { amount: true },
      }),
      prisma.appointment.count({
        where: {
          businessId,
          date: { gte: todayStart },
          service: { type: "training" },
        },
      }),
      prisma.appointment.count({
        where: {
          businessId,
          date: { gte: todayStart },
          service: { type: "grooming" },
        },
      }),
      prisma.boardingStay.count({
        where: { businessId, status: { in: ["reserved", "checked_in"] } },
      }),
      prisma.appointment.groupBy({
        by: ["serviceId"],
        where: {
          businessId,
          date: { gte: monthStart },
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 1,
      }),
      prisma.order.findMany({
        where: { businessId },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.task.findMany({
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
      prisma.task.findMany({
        where: {
          businessId,
          status: { not: "COMPLETED" },
          OR: [
            { dueDate: { lt: todayStart } },
            { dueAt: { lt: todayStart } },
          ],
        },
        orderBy: [{ dueAt: "asc" }, { dueDate: "asc" }],
        take: 10,
      }),
      prisma.lead.findMany({
        where: {
          businessId,
          followUpStatus: "pending",
          nextFollowUpAt: { lte: todayEnd },
        },
        include: {
          customer: { select: { name: true } },
        },
        orderBy: { nextFollowUpAt: "asc" },
        take: 15,
      }),
      // Pending online bookings count
      prisma.booking.count({
        where: { businessId, status: "pending" },
      }),
      // Today's arrivals
      prisma.boardingStay.findMany({
        where: {
          businessId,
          status: "reserved",
          checkIn: { gte: todayStart, lte: todayEnd },
        },
        include: {
          pet: { select: { id: true, name: true, species: true } },
          customer: { select: { id: true, name: true, phone: true } },
          room: { select: { name: true } },
        },
        orderBy: { checkIn: "asc" },
        take: 10,
      }),
      // Today's departures
      prisma.boardingStay.findMany({
        where: {
          businessId,
          status: "checked_in",
          checkOut: { gte: todayStart, lte: todayEnd },
        },
        include: {
          pet: { select: { id: true, name: true, species: true } },
          customer: { select: { id: true, name: true, phone: true } },
          room: { select: { name: true } },
        },
        orderBy: { checkOut: "asc" },
        take: 10,
      }),
      // Tomorrow's appointments
      prisma.appointment.findMany({
        where: {
          businessId,
          date: { gte: tomorrowStart, lte: tomorrowEnd },
          status: "scheduled",
        },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          pet: { select: { name: true } },
          service: { select: { name: true } },
        },
        orderBy: { startTime: "asc" },
      }),
      // Pending payments for top debtors
      prisma.payment.findMany({
        where: { businessId, status: "pending" },
        select: {
          amount: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
      }),
      // At-risk customers
      prisma.customer.findMany({
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
          appointments: {
            select: { date: true },
            orderBy: { date: "desc" },
            take: 1,
          },
          _count: { select: { appointments: true } },
        },
        take: 30,
      }),
      // Pets with birthdays
      prisma.pet.findMany({
        where: { customer: { businessId }, birthDate: { not: null } },
        select: {
          id: true,
          name: true,
          species: true,
          breed: true,
          birthDate: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
      }),
      // Today's revenue
      prisma.payment.aggregate({
        where: {
          businessId,
          status: "paid",
          paidAt: { gte: todayStart, lte: todayEnd },
        },
        _sum: { amount: true },
      }),
      // Last 6 months payments — single query instead of 6 sequential aggregates
      prisma.payment.findMany({
        where: {
          businessId,
          status: "paid",
          paidAt: { gte: sixMonthsStart },
        },
        select: { paidAt: true, amount: true },
      }),
    ]);

    // Top debtors: group pending payments by customer in JS
    const debtorMap = new Map<string, { id: string; name: string; phone: string; total: number }>();
    for (const row of pendingPaymentRows) {
      const key = row.customer.id;
      if (!debtorMap.has(key)) {
        debtorMap.set(key, { ...row.customer, total: 0 });
      }
      debtorMap.get(key)!.total += row.amount;
    }
    const topDebtors = Array.from(debtorMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // At-risk customers: filter in JS
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

    // Get top service name (inline — no extra round-trip needed)
    let topService: { name: string; count: number } | null = null;
    if (topServiceResult.length > 0) {
      const topServiceId = topServiceResult[0].serviceId;
      // Re-use data already fetched: upcomingAppointments includes service details
      const svcFromUpcoming = upcomingAppointments.find(
        (a) => a.service?.id === topServiceId
      );
      const svcName = svcFromUpcoming?.service?.name;
      if (svcName) {
        topService = { name: svcName, count: topServiceResult[0]._count.id };
      } else if (topServiceId) {
        // Fallback: service wasn't in upcoming appointments — look it up
        const svc = await prisma.service.findUnique({
          where: { id: topServiceId },
          select: { name: true },
        });
        if (svc) {
          topService = { name: svc.name, count: topServiceResult[0]._count.id };
        }
      }
    }

    // Upcoming birthdays: filter & compute in JS
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
        const daysUntil = Math.round((thisYearBd.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / (1000 * 60 * 60 * 24));
        const age = now.getFullYear() - bd.getFullYear() - (daysUntil > 0 ? 1 : 0);
        return {
          id: pet.id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          daysUntil,
          age,
          customer: pet.customer,
        };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);

    const todayRevenue = todayRevenueAgg._sum.amount || 0;

    // Revenue by month: group in JS (replaces 6 sequential DB queries)
    const revenueByMonth: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const amount = sixMonthPayments
        .filter(p => p.paidAt && p.paidAt >= mStart && p.paidAt < mEnd)
        .reduce((sum, p) => sum + p.amount, 0);
      revenueByMonth.push({ month: HEBREW_MONTHS[mStart.getMonth()], amount });
    }

    return NextResponse.json({
      totalCustomers,
      totalPets,
      todayAppointments,
      monthRevenue: monthPayments._sum.amount || 0,
      todayRevenue,
      upcomingAppointments,
      recentTasks,
      pendingPayments,
      openLeads,
      activeOrders,
      pendingPaymentsAmount: pendingPaymentsAmount._sum.amount || 0,
      upcomingByType: {
        training: upcomingTraining,
        grooming: upcomingGrooming,
        boarding: activeBoardingStays,
      },
      revenueByMonth,
      revenueTarget: 10000,
      topService,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderType: o.orderType,
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
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
