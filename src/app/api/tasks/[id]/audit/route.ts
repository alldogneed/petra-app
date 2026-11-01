export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { getServerT } from "@/i18n/server";

// Labels live in messages: api.tasks.auditActions.<ACTION>
const AUDIT_ACTIONS = new Set(["CREATED", "COMPLETED", "REOPENED", "CANCELED", "UPDATED", "DELETED"]);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;

    // Verify task belongs to this business
    const task = await prisma.task.findFirst({
      where: { id, businessId: authResult.businessId },
      select: { id: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const logs = await prisma.taskAuditLog.findMany({
      where: { taskId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const t = await getServerT("api.tasks.auditActions");
    const formatted = logs.map((log) => ({
      id: log.id,
      action: log.action,
      actionLabel: AUDIT_ACTIONS.has(log.action) ? t(log.action) : log.action,
      userId: log.userId,
      payload: (() => { try { return JSON.parse(log.payload || "{}"); } catch { return {}; } })(),
      createdAt: log.createdAt,
    }));

    return NextResponse.json({ logs: formatted });
  } catch (error) {
    console.error("Error fetching task audit log:", error);
    return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 });
  }
}
