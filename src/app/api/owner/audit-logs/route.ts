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
  const action = searchParams.get("action")?.slice(0, 80) || undefined;
  const targetType = searchParams.get("targetType") ?? undefined;
  const businessId = searchParams.get("businessId") ?? undefined;
  const parseDate = (v: string | null) => {
    if (!v) return undefined;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"));
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.max(1, Math.min(200, parseInt(searchParams.get("limit") ?? "50", 10) || 50));

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

    // Resolve target ids to display names so the log reads "עסק: שם" instead of a uuid
    const idsOf = (type: string) =>
      Array.from(new Set(logs.filter((l) => l.targetType === type && l.targetId).map((l) => l.targetId as string)));
    const businessTargetIds = idsOf("business");
    const userTargetIds = idsOf("user");
    const [targetBusinesses, targetUsers] = await Promise.all([
      businessTargetIds.length
        ? prisma.business.findMany({ where: { id: { in: businessTargetIds } }, select: { id: true, name: true } })
        : [],
      userTargetIds.length
        ? prisma.platformUser.findMany({ where: { id: { in: userTargetIds } }, select: { id: true, name: true, email: true } })
        : [],
    ]);
    const bizName = new Map(targetBusinesses.map((b) => [b.id, b.name]));
    const userName = new Map(targetUsers.map((u) => [u.id, u.name || u.email]));

    const enriched = logs.map((l) => ({
      ...l,
      targetName:
        l.targetType === "business" ? bizName.get(l.targetId ?? "") ?? null
        : l.targetType === "user" ? userName.get(l.targetId ?? "") ?? null
        : null,
    }));

    return NextResponse.json({ logs: enriched, total, page, limit });
  } catch (error) {
    console.error("GET /api/owner/audit-logs error:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
