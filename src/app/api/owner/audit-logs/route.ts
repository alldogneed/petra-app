export const dynamic = 'force-dynamic';
/**
 * GET /api/owner/audit-logs
 * Paginated audit log viewer with filters.
 * Requires: platform.audit.read
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { PLATFORM_PERMS } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.AUDIT_READ);
  if (isGuardError(guard)) return guard;

  const { searchParams } = new URL(request.url);
  const actorId = searchParams.get("actorId") ?? undefined;
  const action = searchParams.get("action") ?? undefined;
  const targetType = searchParams.get("targetType") ?? undefined;
  const businessId = searchParams.get("businessId") ?? undefined;
  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
  const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(200, parseInt(searchParams.get("limit") ?? "50"));

  const where: Record<string, unknown> = {};
  if (actorId) where.actorUserId = actorId;
  if (action) where.action = { contains: action };
  if (targetType) where.targetType = targetType;
  if (businessId) where.actorBusinessId = businessId;
  if (from || to) {
    where.timestamp = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  try {
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
    console.error("GET /api/owner/audit-logs error:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
