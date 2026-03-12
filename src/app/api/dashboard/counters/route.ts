export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/dashboard/counters
// Lightweight endpoint for sidebar badges — returns urgent counts only.
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const now = new Date();

    const [openTasks, overdueFollowUps, pendingBookings] = await Promise.all([
      // Open tasks (not completed/canceled)
      prisma.task.count({
        where: {
          businessId: authResult.businessId,
          status: "OPEN",
        },
      }),

      // Leads with a follow-up that is past-due and status is still "pending"
      prisma.lead.count({
        where: {
          businessId: authResult.businessId,
          nextFollowUpAt: { lt: now },
          followUpStatus: "pending",
          stage: { not: "won" },
          lostAt: null,
        },
      }),

      // Online bookings awaiting approval
      prisma.booking.count({
        where: { businessId: authResult.businessId, status: "pending" },
      }),
    ]);

    return NextResponse.json(
      { openTasks, overdueFollowUps, pendingBookings },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=30" } }
    );
  } catch (error) {
    console.error("Error fetching counters:", error);
    return NextResponse.json({ openTasks: 0, overdueFollowUps: 0, pendingBookings: 0 });
  }
}
