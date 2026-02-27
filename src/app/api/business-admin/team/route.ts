export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (isGuardError(authResult)) return authResult;

  const user = await getCurrentUser();
  if (!user || !["owner", "admin"].includes(user.businessRole ?? "") || !user.businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bizId = user.businessId;

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
