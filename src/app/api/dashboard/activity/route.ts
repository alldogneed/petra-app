export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { type TenantRole } from "@/lib/permissions";

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "התחברות למערכת",
  CREATE_CUSTOMER: "יצירת לקוח חדש",
  UPDATE_CUSTOMER: "עדכון פרטי לקוח",
  DELETE_CUSTOMER: "מחיקת לקוח",
  EXPORT_CUSTOMERS: "ייצוא לקוחות",
  CREATE_ORDER: "יצירת הזמנה",
  UPDATE_ORDER: "עדכון הזמנה",
  CREATE_PAYMENT: "רישום תשלום",
  CREATE_APPOINTMENT: "קביעת תור",
  UPDATE_APPOINTMENT: "עדכון תור",
  CANCEL_APPOINTMENT: "ביטול תור",
  CREATE_BOOKING: "יצירת הזמנה אונליין",
  UPDATE_BOOKING: "עדכון הזמנה אונליין",
  DELETE_BOOKING: "מחיקת הזמנה אונליין",
  CREATE_LEAD: "יצירת ליד",
  UPDATE_LEAD: "עדכון ליד",
  DELETE_LEAD: "מחיקת ליד",
  ADD_PET: "הוספת חיית מחמד",
  CREATE_TASK: "יצירת משימה",
  COMPLETE_TASK: "השלמת משימה",
  CREATE_BOARDING: "יצירת שהייה בפנסיון",
  CHECK_IN: "צ׳ק-אין לפנסיון",
  CHECK_OUT: "צ׳ק-אאוט מפנסיון",
  UPDATE_SETTINGS: "עדכון הגדרות",
  INVITE_MEMBER: "הזמנת חבר צוות",
  REMOVE_MEMBER: "הסרת חבר צוות",
};

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Staff and volunteers cannot view activity log
    const membership = authResult.session.memberships.find(
      (m) => m.businessId === authResult.businessId && m.isActive
    );
    const callerRole = (membership?.role ?? "user") as TenantRole;
    if (callerRole === "user" || callerRole === "volunteer") {
      return NextResponse.json({ activities: [] });
    }

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
        description: `תזכורת וואטסאפ ל${msg.customer?.name ?? "נמען"}`,
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
