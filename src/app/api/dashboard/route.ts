export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { hasTenantPermission, TENANT_PERMS, type TenantRole } from "@/lib/permissions";
import { getDashboardMetrics } from "@/services/business";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { businessId, session } = authResult;

    const membership = session.memberships.find((m) => m.businessId === businessId);
    const callerRole = (membership?.role ?? "user") as TenantRole;
    const canSeeRevenueSummary = hasTenantPermission(
      callerRole,
      TENANT_PERMS.FINANCE_SUMMARY,
      membership?.permissionOverrides ?? null
    );

    // ?date=YYYY-MM-DD moves the dashboard's "today" so the user can look ahead
    const anchorDate = new URL(request.url).searchParams.get("date");

    const data = await getDashboardMetrics(businessId, prisma, { canSeeRevenueSummary, anchorDate });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
