export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformRole, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { PLATFORM_ROLES } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const guard = await requirePlatformRole(request, [
      PLATFORM_ROLES.SUPER_ADMIN,
      PLATFORM_ROLES.ADMIN,
      PLATFORM_ROLES.SUPPORT,
    ]);
    if (isGuardError(guard)) return guard;

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalConnections,
      activeConnections,
      calls24h,
      calls7d,
      errors24h,
      recentLogs,
      popularTools,
    ] = await Promise.all([
      prisma.mcpConnection.count(),
      prisma.mcpConnection.count({ where: { revokedAt: null } }),
      prisma.mcpAuditLog.count({ where: { createdAt: { gte: last24h } } }),
      prisma.mcpAuditLog.count({ where: { createdAt: { gte: last7d } } }),
      prisma.mcpAuditLog.count({ where: { createdAt: { gte: last24h }, status: "error" } }),
      prisma.mcpAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          toolName: true,
          status: true,
          resultSummary: true,
          errorMessage: true,
          createdAt: true,
          connection: { select: { name: true, business: { select: { name: true } } } },
        },
      }),
      prisma.mcpAuditLog.groupBy({
        by: ["toolName"],
        _count: { toolName: true },
        where: { createdAt: { gte: last30d } },
        orderBy: { _count: { toolName: "desc" } },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      totalConnections,
      activeConnections,
      calls24h,
      calls7d,
      errors24h,
      errorRate24h: calls24h > 0 ? Math.round((errors24h / calls24h) * 100) : 0,
      popularTools: popularTools.map((t) => ({ tool: t.toolName, count: t._count.toolName })),
      recentLogs,
    });
  } catch (error) {
    console.error("GET /api/owner/mcp-stats error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת נתוני MCP" }, { status: 500 });
  }
}
