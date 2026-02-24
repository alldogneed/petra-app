import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const businessId = DEMO_BUSINESS_ID;

    const [totalCustomers, totalPets, todayAppointments, upcomingAppointments, recentTasks, pendingPayments, monthPayments, openLeads] =
      await Promise.all([
        prisma.customer.count({ where: { businessId } }),
        prisma.pet.count({
          where: { customer: { businessId } },
        }),
        prisma.appointment.count({
          where: {
            businessId,
            date: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lt: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
        }),
        prisma.appointment.findMany({
          where: {
            businessId,
            date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            status: "scheduled",
          },
          include: {
            customer: { select: { name: true } },
            pet: { select: { name: true, species: true } },
            service: { select: { id: true, name: true, color: true } },
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          take: 8,
        }),
        prisma.task.findMany({
          where: {
            businessId,
            status: { not: "COMPLETED" },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.payment.count({
          where: {
            businessId,
            status: "pending",
          },
        }),
        prisma.payment.aggregate({
          where: {
            businessId,
            status: "paid",
            paidAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
          _sum: { amount: true },
        }),
        prisma.lead.count({
          where: {
            businessId,
            stage: { in: ["new", "contacted", "qualified"] },
          },
        }),
      ]);

    return NextResponse.json({
      totalCustomers,
      totalPets,
      todayAppointments,
      monthRevenue: monthPayments._sum.amount || 0,
      upcomingAppointments,
      recentTasks,
      pendingPayments,
      openLeads,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
