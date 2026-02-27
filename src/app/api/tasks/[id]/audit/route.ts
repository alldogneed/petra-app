export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

const ACTION_LABELS: Record<string, string> = {
  CREATED: "נוצרה",
  COMPLETED: "הושלמה",
  REOPENED: "נפתחה מחדש",
  CANCELED: "בוטלה",
  UPDATED: "עודכנה",
  DELETED: "נמחקה",
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;

    // Verify task belongs to this business
    const task = await prisma.task.findFirst({
      where: { id, businessId: DEMO_BUSINESS_ID },
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

    const formatted = logs.map((log) => ({
      id: log.id,
      action: log.action,
      actionLabel: ACTION_LABELS[log.action] ?? log.action,
      userId: log.userId,
      payload: JSON.parse(log.payload || "{}"),
      createdAt: log.createdAt,
    }));

    return NextResponse.json({ logs: formatted });
  } catch (error) {
    console.error("Error fetching task audit log:", error);
    return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 });
  }
}
