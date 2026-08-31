export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessActivity } from "@/services/business";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const user = await getCurrentUser();
    if (!user || user.businessRole !== "owner" || !user.businessId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filterUserId = searchParams.get("userId");
    const filterAction = searchParams.get("action");
    const take = Math.min(parseInt(searchParams.get("take") || "50"), 100);

    const activities = await getBusinessActivity(user.businessId, prisma, {
      userId: filterUserId,
      action: filterAction,
      take,
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error("business-admin/activity GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
