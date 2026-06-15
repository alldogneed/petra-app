export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import { getAnalytics } from "@/services/business";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const membership = session.memberships.find((m) => m.businessId === businessId);
    const analyticsRole = (membership?.role ?? "user") as TenantRole;
    const canSeeRevenue = hasTenantPermission(analyticsRole, TENANT_PERMS.FINANCE_SUMMARY);

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "month";
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const data = await getAnalytics(businessId, prisma, { period, from, to, canSeeRevenue });
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
