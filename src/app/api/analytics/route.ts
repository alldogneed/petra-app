export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";

// GET /api/analytics – aggregated analytics data for dashboard
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId: analyticsBusinessId, session: analyticsSession } = authResult;

    // Check revenue summary permission (owner-only)
    const analyticsMembership = analyticsSession.memberships.find((m) => m.businessId === analyticsBusinessId);
    const analyticsRole = (analyticsMembership?.role ?? "user") as TenantRole;
    const canSeeRevenue = hasTenantPermission(analyticsRole, TENANT_PERMS.FINANCE_SUMMARY);

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "month"; // week | month | quarter | year
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

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
        default: // month
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    // Previous period for comparison — based on the selected range's end,
    // not "now", so custom ranges compare against an equal-length window.
    const periodLength = toDate.getTime() - fromDate.getTime();
    const prevFrom = new Date(fromDate.getTime() - periodLength);
    const prevTo = fromDate;

    // All period-scoped queries must be bounded on both ends; otherwise a
    // custom range leaks later data and future-dated appointments inflate counts.
    const inPeriod = { gte: fromDate, lte: toDate };
    const inPrevPeriod = { gte: prevFrom, lt: prevTo };

    // Query lead stages to get their IDs (for analytics queries)
    const leadStages = await prisma.leadStage.findMany({
      where: { businessId: authResult.businessId },
    });
    const activeStageIds = leadStages.filter((s) => !s.isWon && !s.isLost).map((s) => s.id);
    const wonStageIds = leadStages.filter((s) => s.isWon).map((s) => s.id);
    const lostStageIds = leadStages.filter((s) => s.isLost).map((s) => s.id);

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
      completedTrainingSessions,
      activeTrainingGroups,
      completedGroupSessions,
      trainingRevenueAgg,
      boardingStays,
      appointmentsByDate,
    ] = await Promise.all([
      // Total customers
      prisma.customer.count({ where: { businessId: authResult.businessId } }),
      // New customers this period
      prisma.customer.count({
        where: { businessId: authResult.businessId, createdAt: inPeriod },
      }),
      // New customers previous period
      prisma.customer.count({
        where: { businessId: authResult.businessId, createdAt: inPrevPeriod },
      }),
      // Appointments this period
      prisma.appointment.count({
        where: { businessId: authResult.businessId, date: inPeriod },
      }),
      // Appointments previous period
      prisma.appointment.count({
        where: { businessId: authResult.businessId, date: inPrevPeriod },
      }),
      // Completed appointments
      prisma.appointment.count({
        where: { businessId: authResult.businessId, date: inPeriod, status: { in: ["completed", "COMPLETED"] } },
      }),
      // Canceled appointments
      prisma.appointment.count({
        where: { businessId: authResult.businessId, date: inPeriod, status: "canceled" },
      }),
      // Payments this period — paid only, by paidAt (same definition as the
      // dashboard's monthRevenue, so the two screens always agree)
      prisma.payment.aggregate({
        where: { businessId: authResult.businessId, status: "paid", paidAt: inPeriod },
        _sum: { amount: true },
        _count: true,
      }),
      // Payments previous period
      prisma.payment.aggregate({
        where: { businessId: authResult.businessId, status: "paid", paidAt: inPrevPeriod },
        _sum: { amount: true },
      }),
      // Open tasks
      prisma.task.count({
        where: { businessId: authResult.businessId, status: "OPEN" },
      }),
      // Completed tasks this period
      prisma.task.count({
        where: { businessId: authResult.businessId, status: "COMPLETED", completedAt: inPeriod },
      }),
      // Active leads (non-won, non-lost stages)
      prisma.lead.count({
        where: { businessId: authResult.businessId, stage: { in: activeStageIds } },
      }),
      // Won leads this period — wonAt, not updatedAt (any edit bumps updatedAt)
      prisma.lead.count({
        where: { businessId: authResult.businessId, stage: { in: wonStageIds }, wonAt: inPeriod },
      }),
      // Lost leads this period
      prisma.lead.count({
        where: { businessId: authResult.businessId, stage: { in: lostStageIds }, lostAt: inPeriod },
      }),
      // Active training programs
      prisma.trainingProgram.count({
        where: { businessId: authResult.businessId, status: "ACTIVE" },
      }),
      // Completed training sessions this period
      prisma.trainingProgramSession.count({
        where: { program: { businessId: authResult.businessId }, status: "COMPLETED", sessionDate: inPeriod },
      }),
      // Active training groups
      prisma.trainingGroup.count({
        where: { businessId: authResult.businessId, isActive: true },
      }),
      // Completed group sessions this period
      prisma.trainingGroupSession.count({
        where: { trainingGroup: { businessId: authResult.businessId }, status: "COMPLETED", sessionDatetime: inPeriod },
      }),
      // Training revenue this period (program price, ACTIVE/COMPLETED started in period)
      prisma.trainingProgram.aggregate({
        where: { businessId: authResult.businessId, status: { in: ["ACTIVE", "COMPLETED"] }, startDate: inPeriod },
        _sum: { price: true },
      }),
      // Boarding stays this period
      prisma.boardingStay.count({
        where: { businessId: authResult.businessId, checkIn: inPeriod },
      }),
      // Appointments by date (for chart)
      prisma.appointment.groupBy({
        by: ["date"],
        where: { businessId: authResult.businessId, date: inPeriod },
        _count: true,
        orderBy: { date: "asc" },
      }),
    ]);

    const currentRevenue = totalPayments._sum.amount || 0;
    const previousRevenue = prevPayments._sum.amount || 0;

    // Appointments by day of week and hour (for scheduling heatmap)
    const allAppointments = await prisma.appointment.findMany({
      where: { businessId: authResult.businessId, date: inPeriod },
      select: { date: true, startTime: true },
    });

    const dayLabels = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
    const byDayOfWeek = Array.from({ length: 7 }, (_, i) => ({ day: dayLabels[i], count: 0 }));
    const byHour: Record<number, number> = {};

    for (const a of allAppointments) {
      const dow = new Date(a.date).getDay(); // 0=Sun
      byDayOfWeek[dow].count += 1;
      const hour = parseInt(a.startTime.split(":")[0], 10);
      if (!isNaN(hour)) byHour[hour] = (byHour[hour] || 0) + 1;
    }

    const appointmentsByHour = Object.entries(byHour)
      .map(([h, count]) => ({ hour: parseInt(h, 10), label: `${h}:00`, count }))
      .sort((a, b) => a.hour - b.hour);

    // Top customers by revenue this period
    const topCustomerPayments = await prisma.payment.findMany({
      where: { businessId: authResult.businessId, status: "paid", paidAt: inPeriod },
      select: {
        amount: true,
        customer: { select: { id: true, name: true } },
      },
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

    // Revenue by service type this period (via appointment.service)
    const servicePayments = await prisma.payment.findMany({
      where: {
        businessId: authResult.businessId,
        status: "paid",
        paidAt: inPeriod,
        appointmentId: { not: null },
      },
      select: {
        amount: true,
        appointment: { select: { service: { select: { name: true } } } },
      },
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

    // Retention: customers with more than 1 appointment (returning) vs total with any appointment
    const allCustomerAppointments = await prisma.appointment.groupBy({
      by: ["customerId"],
      where: { businessId: authResult.businessId },
      _count: true,
    });
    const returningCustomers = allCustomerAppointments.filter((c) => c._count > 1).length;
    const customersWithAppointments = allCustomerAppointments.length;
    const retentionRate = customersWithAppointments > 0
      ? Math.round((returningCustomers / customersWithAppointments) * 100)
      : 0;
    const avgRevenuePerCustomer = totalCustomers > 0
      ? Math.round((currentRevenue / totalCustomers) * 100) / 100
      : 0;

    // Pet demographics (species + top breeds) — static, not period-dependent.
    // Pet.customerId is nullable: standalone pets (e.g. service dogs) carry
    // businessId directly, so match either path — same as the XLSX export.
    const allPets = await prisma.pet.findMany({
      where: {
        OR: [
          { customer: { businessId: authResult.businessId } },
          { businessId: authResult.businessId },
        ],
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
      bySpecies: Object.entries(speciesCount).map(([species, count]) => ({ species, count })).sort((a, b) => b.count - a.count),
      topBreeds: Object.entries(breedCount).map(([breed, count]) => ({ breed, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    };

    // Calculate percentage changes
    const calcChange = (current: number, previous: number): number | null => {
      if (previous === 0) return current > 0 ? null : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return NextResponse.json({
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
        completionRate: totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0,
        revenue: canSeeRevenue ? currentRevenue : null,
        revenueChange: canSeeRevenue ? calcChange(currentRevenue, previousRevenue) : null,
        paymentCount: canSeeRevenue ? totalPayments._count : null,
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
        completedSessionsThisPeriod: completedTrainingSessions,
        activeGroups: activeTrainingGroups,
        groupSessionsThisPeriod: completedGroupSessions,
        revenue: canSeeRevenue ? (trainingRevenueAgg._sum.price || 0) : null,
      },
      boarding: {
        staysThisPeriod: boardingStays,
      },
      charts: {
        appointmentsByDate: appointmentsByDate.map((a) => ({
          date: a.date,
          count: a._count,
        })),
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
    });
  } catch (error) {
    console.error("GET /api/analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
