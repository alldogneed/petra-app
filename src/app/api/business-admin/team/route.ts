export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (isGuardError(authResult)) return authResult;

  const { session } = authResult;

  // Verify user is an active owner or admin of this business
  const membership = session.memberships.find(
    (m) => m.businessId === DEMO_BUSINESS_ID && m.isActive
  );
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bizId = DEMO_BUSINESS_ID;

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
}
