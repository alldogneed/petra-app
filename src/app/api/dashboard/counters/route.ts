import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/dashboard/counters
// Lightweight endpoint for sidebar badges — returns urgent counts only.
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const now = new Date();

    const [openTasks, overdueFollowUps] = await Promise.all([
      // Open tasks (not completed/canceled)
      prisma.task.count({
        where: {
          businessId: DEMO_BUSINESS_ID,
          status: "OPEN",
        },
      }),

      // Leads with a follow-up that is past-due and status is still "pending"
      prisma.lead.count({
        where: {
          businessId: DEMO_BUSINESS_ID,
          nextFollowUpAt: { lt: now },
          followUpStatus: "pending",
          stage: { not: "won" },
          lostAt: null,
        },
      }),
    ]);

    return NextResponse.json({ openTasks, overdueFollowUps });
  } catch (error) {
    console.error("Error fetching counters:", error);
    return NextResponse.json({ openTasks: 0, overdueFollowUps: 0 });
  }
}
