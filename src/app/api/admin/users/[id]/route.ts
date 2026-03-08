export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { PLATFORM_PERMS } from "@/lib/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.USERS_READ);
  if (isGuardError(guard)) return guard;

  const user = await prisma.platformUser.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      platformRole: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      authProvider: true,
      twoFaEnabled: true,
      businessMemberships: {
        include: { business: { select: { id: true, name: true, tier: true, featureOverrides: true } } },
      },
      sessions: {
        orderBy: { lastSeenAt: "desc" },
        take: 5,
        select: {
          id: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          lastSeenAt: true,
          expiresAt: true,
        },
      },
      activityLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, action: true, createdAt: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Count total activity
  const totalActivity = await prisma.activityLog.count({ where: { userId: params.id } });

  return NextResponse.json({ ...user, totalActivity });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.USERS_WRITE);
  if (isGuardError(guard)) return guard;

  const body = await request.json();
  const { isActive, platformRole } = body;

  const data: Record<string, unknown> = {};
  if (typeof isActive === "boolean") data.isActive = isActive;
  if (platformRole !== undefined) data.platformRole = platformRole || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.platformUser.update({
    where: { id: params.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      platformRole: true,
      isActive: true,
    },
  });

  return NextResponse.json(updated);
  } catch (error) {
    console.error("Admin PATCH user error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
