export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { session } = authResult;

    // Verify user is an active owner or admin of this business
    const membership = session.memberships.find(
      (m) => m.businessId === authResult.businessId && m.isActive
    );
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const bizId = authResult.businessId;

    const members = await prisma.businessUser.findMany({
      where: { businessId: bizId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
            isActive: true,
            sessions: {
              where: { expiresAt: { gt: new Date() } },
              orderBy: { lastSeenAt: "desc" },
              take: 1,
              select: {
                lastSeenAt: true,
                ipAddress: true,
                userAgent: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("business-admin/team GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
