import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const businessId = DEMO_BUSINESS_ID;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

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
    ] = await Promise.all([
      prisma.customer.count({ where: { businessId } }),
      prisma.pet.count({ where: { customer: { businessId } } }),
      prisma.appointment.count({
        where: { businessId, date: { gte: todayStart, lt: todayEnd } },
      }),
      prisma.appointment.findMany({
        where: {
          businessId,
          date: { gte: todayStart },
          status: "scheduled",
        },
        include: {
          customer: { select: { name: true } },
          pet: { select: { name: true, species: true } },
          service: { select: { id: true, name: true, color: true, type: true } },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 8,
      }),
      prisma.task.findMany({
        where: { businessId, status: { not: "COMPLETED" } },
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
        where: { businessId, stage: { in: ["new", "contacted", "qualified"] } },
      }),
      // New queries
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
      // Today's tasks (for Daily Focus): tasks due today that aren't completed
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
      // Overdue tasks: past due date and not completed
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
    ]);

    // Get top service name
    let topService: { name: string; count: number } | null = null;
    if (topServiceResult.length > 0) {
      const svc = await prisma.service.findUnique({
        where: { id: topServiceResult[0].serviceId },
        select: { name: true },
      });
      if (svc) {
        topService = { name: svc.name, count: topServiceResult[0]._count.id };
      }
    }

    // Revenue by month (last 6 months)
    const revenueByMonth: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const agg = await prisma.payment.aggregate({
        where: {
          businessId,
          status: "paid",
          paidAt: { gte: mStart, lt: mEnd },
        },
        _sum: { amount: true },
      });
      revenueByMonth.push({
        month: HEBREW_MONTHS[mStart.getMonth()],
        amount: agg._sum.amount || 0,
      });
    }

    return NextResponse.json({
      totalCustomers,
      totalPets,
      todayAppointments,
      monthRevenue: monthPayments._sum.amount || 0,
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
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
