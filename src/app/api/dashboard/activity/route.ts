export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "התחברות למערכת",
  CREATE_CUSTOMER: "יצירת לקוח חדש",
  UPDATE_CUSTOMER: "עדכון פרטי לקוח",
  CREATE_ORDER: "יצירת הזמנה",
  UPDATE_ORDER: "עדכון הזמנה",
  CREATE_PAYMENT: "רישום תשלום",
  CREATE_APPOINTMENT: "קביעת תור",
  UPDATE_APPOINTMENT: "עדכון תור",
  CANCEL_APPOINTMENT: "ביטול תור",
  CREATE_LEAD: "יצירת ליד",
  UPDATE_LEAD: "עדכון ליד",
  ADD_PET: "הוספת חיית מחמד",
  CREATE_TASK: "יצירת משימה",
  COMPLETE_TASK: "השלמת משימה",
  CREATE_BOARDING: "יצירת שהייה בפנסיון",
  CHECK_IN: "צ׳ק-אין לפנסיון",
  CHECK_OUT: "צ׳ק-אאוט מפנסיון",
};

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { businessId } = authResult;

    // Get all user IDs that belong to this business
    const businessMembers = await prisma.businessUser.findMany({
      where: { businessId },
      select: { userId: true },
    });
    const businessUserIds = businessMembers.map((m) => m.userId);

    const [activityLogs, scheduledMessages] = await Promise.all([
      prisma.activityLog.findMany({
        where: { createdAt: { gte: since }, userId: { in: businessUserIds } },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.scheduledMessage.findMany({
        where: {
          businessId,
          status: { in: ["SENT", "FAILED"] },
          updatedAt: { gte: since },
        },
        include: { customer: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ]);

    const activities = [
      ...activityLogs.map((log) => ({
        id: log.id,
        type: "activity" as const,
        userName: log.userName,
        action: log.action,
        description: ACTION_LABELS[log.action] || log.action,
        createdAt: log.createdAt.toISOString(),
      })),
      ...scheduledMessages.map((msg) => ({
        id: msg.id,
        type: "whatsapp" as const,
        userName: "מערכת",
        action: "WHATSAPP_SEND",
        description: `תזכורת וואטסאפ ל${msg.customer.name}`,
        createdAt: msg.updatedAt.toISOString(),
        channel: msg.channel,
        status: msg.status,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ activities });
  } catch (error) {
    console.error("Activity feed error:", error);
    return NextResponse.json(
      { error: "Failed to load activity feed" },
      { status: 500 }
    );
  }
}
