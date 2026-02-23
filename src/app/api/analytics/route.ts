import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

// GET /api/analytics – aggregated analytics data for dashboard
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "month"; // week | month | quarter | year

    const now = new Date();
    let fromDate: Date;
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
      default: // month
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Previous period for comparison
    const periodLength = now.getTime() - fromDate.getTime();
    const prevFrom = new Date(fromDate.getTime() - periodLength);
    const prevTo = fromDate;

    // Gather all stats in parallel
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
      boardingStays,
      appointmentsByDate,
    ] = await Promise.all([
      // Total customers
      prisma.customer.count({ where: { businessId: DEMO_BUSINESS_ID } }),
      // New customers this period
      prisma.customer.count({
        where: { businessId: DEMO_BUSINESS_ID, createdAt: { gte: fromDate } },
      }),
      // New customers previous period
      prisma.customer.count({
        where: { businessId: DEMO_BUSINESS_ID, createdAt: { gte: prevFrom, lt: prevTo } },
      }),
      // Appointments this period
      prisma.appointment.count({
        where: { businessId: DEMO_BUSINESS_ID, date: { gte: fromDate } },
      }),
      // Appointments previous period
      prisma.appointment.count({
        where: { businessId: DEMO_BUSINESS_ID, date: { gte: prevFrom, lt: prevTo } },
      }),
      // Completed appointments
      prisma.appointment.count({
        where: { businessId: DEMO_BUSINESS_ID, date: { gte: fromDate }, status: { in: ["completed", "COMPLETED"] } },
      }),
      // Canceled appointments
      prisma.appointment.count({
        where: { businessId: DEMO_BUSINESS_ID, date: { gte: fromDate }, status: { in: ["canceled", "CANCELED", "cancelled"] } },
      }),
      // Payments this period
      prisma.payment.aggregate({
        where: { businessId: DEMO_BUSINESS_ID, createdAt: { gte: fromDate } },
        _sum: { amount: true },
        _count: true,
      }),
      // Payments previous period
      prisma.payment.aggregate({
        where: { businessId: DEMO_BUSINESS_ID, createdAt: { gte: prevFrom, lt: prevTo } },
        _sum: { amount: true },
      }),
      // Open tasks
      prisma.task.count({
        where: { businessId: DEMO_BUSINESS_ID, status: "OPEN" },
      }),
      // Completed tasks this period
      prisma.task.count({
        where: { businessId: DEMO_BUSINESS_ID, status: "COMPLETED", completedAt: { gte: fromDate } },
      }),
      // Active leads
      prisma.lead.count({
        where: { businessId: DEMO_BUSINESS_ID, stage: { in: ["new", "contacted", "qualified"] } },
      }),
      // Won leads this period
      prisma.lead.count({
        where: { businessId: DEMO_BUSINESS_ID, stage: "won", updatedAt: { gte: fromDate } },
      }),
      // Lost leads this period
      prisma.lead.count({
        where: { businessId: DEMO_BUSINESS_ID, stage: "lost", lostAt: { gte: fromDate } },
      }),
      // Active training programs
      prisma.trainingProgram.count({
        where: { businessId: DEMO_BUSINESS_ID, status: "ACTIVE" },
      }),
      // Boarding stays this period
      prisma.boardingStay.count({
        where: { businessId: DEMO_BUSINESS_ID, checkIn: { gte: fromDate } },
      }),
      // Appointments by date (for chart) - last 30 days
      prisma.appointment.groupBy({
        by: ["date"],
        where: { businessId: DEMO_BUSINESS_ID, date: { gte: fromDate } },
        _count: true,
        orderBy: { date: "asc" },
      }),
    ]);

    const currentRevenue = totalPayments._sum.amount || 0;
    const previousRevenue = prevPayments._sum.amount || 0;

    // Calculate percentage changes
    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return NextResponse.json({
      period,
      from: fromDate.toISOString(),
      to: now.toISOString(),
      overview: {
        totalCustomers,
        newCustomers,
        newCustomersChange: calcChange(newCustomers, prevNewCustomers),
        totalAppointments,
        appointmentsChange: calcChange(totalAppointments, prevAppointments),
        completedAppointments,
        canceledAppointments,
        completionRate: totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0,
        revenue: currentRevenue,
        revenueChange: calcChange(currentRevenue, previousRevenue),
        paymentCount: totalPayments._count,
      },
      tasks: {
        open: openTasks,
        completedThisPeriod: completedTasks,
      },
      leads: {
        active: activeLeads,
        wonThisPeriod: wonLeads,
        lostThisPeriod: lostLeads,
        conversionRate: wonLeads + lostLeads > 0 ? Math.round((wonLeads / (wonLeads + lostLeads)) * 100) : 0,
      },
      training: {
        activePrograms,
      },
      boarding: {
        staysThisPeriod: boardingStays,
      },
      charts: {
        appointmentsByDate: appointmentsByDate.map((a) => ({
          date: a.date,
          count: a._count,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
