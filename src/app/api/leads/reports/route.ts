export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessPermission, isGuardError } from "@/lib/auth-guards";
import { TENANT_PERMS } from "@/lib/permissions";
import { getLeadsReport } from "@/services/leads-reports";
import { ServiceError } from "@/services/types";

/**
 * GET /api/leads/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&basis=cohort|activity
 *
 * Access: ANALYTICS_READ (owner + manager by default, honours per-member permission overrides;
 * super_admin impersonation passes). Others → 403.
 * Money: deal values ("ערך עסקה") are already visible to managers in the leads kanban, and they are
 * NOT revenue (CLAUDE.md rule #28) — so every caller allowed here gets canSeeMoney = true.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessPermission(request, TENANT_PERMS.ANALYTICS_READ);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const { searchParams } = new URL(request.url);
    const data = await getLeadsReport(businessId, prisma, {
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      basis: searchParams.get("basis"),
      canSeeMoney: true,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ServiceError) {
      const status = error.code === "VALIDATION" ? 400 : error.code === "NOT_FOUND" ? 404 : error.code === "UNAUTHORIZED" ? 403 : error.code === "CONFLICT" ? 409 : 500;
      return NextResponse.json({ error: status === 500 ? "שגיאה בטעינת דוח המכירות" : error.message }, { status });
    }
    console.error("GET /api/leads/reports error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת דוח המכירות" }, { status: 500 });
  }
}
