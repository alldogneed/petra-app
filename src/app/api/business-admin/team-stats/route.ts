export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { getCurrentUser } from "@/lib/auth";
import { getTeamStats, ServiceError } from "@/services/business-admin-team";
import { parseTeamStatsDays } from "@/lib/team-stats";

/**
 * GET /api/business-admin/team-stats?days=7|30|90  (owner only; default 30)
 * → { days, members: [{ userId, name, role, isActive, lastActiveAt, counts, openTasks, overdueTasks }] }
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const user = await getCurrentUser();
    if (!user || user.businessRole !== "owner" || !user.businessId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const days = parseTeamStatsDays(new URL(request.url).searchParams.get("days"));
    if (days === null) {
      return NextResponse.json({ error: "days must be 7, 30 or 90" }, { status: 400 });
    }

    const data = await getTeamStats(user.businessId, prisma, days);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ServiceError && error.code === "VALIDATION") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("business-admin/team-stats GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
