export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { isPlatformAdmin, TENANT_ROLES } from "@/lib/permissions";
import { getLeadsReport } from "@/services/leads-reports";
import { ServiceError } from "@/services/types";

/**
 * GET /api/leads/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&basis=cohort|activity
 *
 * Access: owner / manager of the business, or a platform admin (impersonation). Staff → 403.
 * Money: deal values ("ערך עסקה") are already visible to managers in the leads kanban, and they are
 * NOT revenue (CLAUDE.md rule #28) — so every caller allowed here gets canSeeMoney = true.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const membership = session.memberships.find((m) => m.businessId === businessId && m.isActive);
    const isManagerOrOwner =
      membership?.role === TENANT_ROLES.OWNER || membership?.role === TENANT_ROLES.MANAGER;
    if (!isManagerOrOwner && !isPlatformAdmin(session.user.platformRole)) {
      return NextResponse.json({ error: "אין לך הרשאה לצפות בדוחות מכירות" }, { status: 403 });
    }

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
