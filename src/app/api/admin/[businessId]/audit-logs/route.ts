export const dynamic = 'force-dynamic';
/**
 * GET /api/admin/[businessId]/audit-logs
 * Tenant-scoped audit log viewer.
 * Requires: tenant.audit.read
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { TENANT_PERMS } from "@/lib/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    const guard = await requireTenantPermission(
      request,
      params.businessId,
      TENANT_PERMS.AUDIT_READ
    );
    if (isGuardError(guard)) return guard;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") ?? undefined;
    const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
    const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));

    const where: Record<string, unknown> = {
      actorBusinessId: params.businessId,
    };
    if (action) where.action = { contains: action };
    if (from || to) {
      where.timestamp = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          actor: { select: { id: true, email: true, name: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, page, limit });
  } catch (error) {
    console.error("GET audit-logs error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת יומן פעולות" }, { status: 500 });
  }
}
