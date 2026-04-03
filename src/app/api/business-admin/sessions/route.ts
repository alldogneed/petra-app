export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const user = await getCurrentUser();
    if (!user || !["owner", "admin"].includes(user.businessRole ?? "") || !user.businessId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const bizId = user.businessId;

    // Get ONLY users who are members of THIS business
    const businessUsers = await prisma.businessUser.findMany({
      where: { businessId: bizId },
      select: { userId: true, role: true },
    });
    const bizUserIds = businessUsers.map((bu) => bu.userId);
    const roleMap = Object.fromEntries(businessUsers.map((bu) => [bu.userId, bu.role]));

    // Sessions filtered strictly to this business's members
    const sessions = await prisma.adminSession.findMany({
      where: {
        userId: { in: bizUserIds },
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { lastSeenAt: "desc" },
    });

    const enriched = sessions.map((s) => ({
      ...s,
      businessRole: roleMap[s.userId] ?? "user",
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("business-admin/sessions GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
