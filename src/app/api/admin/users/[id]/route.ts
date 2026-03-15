export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { PLATFORM_PERMS, PLATFORM_ROLES } from "@/lib/permissions";
import { logAudit, getRequestContext, AUDIT_ACTIONS } from "@/lib/audit";

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
        include: {
          business: {
            select: {
              id: true, name: true, tier: true, featureOverrides: true,
              members: {
                select: {
                  id: true, role: true, isActive: true,
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
        },
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.USERS_WRITE);
  if (isGuardError(guard)) return guard;
  const { session } = guard;

  // Only super_admin may delete users
  if (session.user.platformRole !== PLATFORM_ROLES.SUPER_ADMIN) {
    return NextResponse.json({ error: "Only super_admin can delete users" }, { status: 403 });
  }

  // Cannot delete self
  if (params.id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const target = await prisma.platformUser.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, name: true, platformRole: true },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Cannot delete another super_admin
  if (target.platformRole === PLATFORM_ROLES.SUPER_ADMIN) {
    return NextResponse.json({ error: "Cannot delete another super_admin" }, { status: 403 });
  }

  // Cascade-delete all user-related records, then the user
  await prisma.$transaction([
    prisma.adminSession.deleteMany({ where: { userId: params.id } }),
    prisma.activityLog.deleteMany({ where: { userId: params.id } }),
    prisma.businessUser.deleteMany({ where: { userId: params.id } }),
    prisma.userConsent.deleteMany({ where: { userId: params.id } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: params.id } }),
    prisma.notification.deleteMany({ where: { userId: params.id } }),
    prisma.onboardingProgress.deleteMany({ where: { userId: params.id } }),
    prisma.onboardingProfile.deleteMany({ where: { userId: params.id } }),
    prisma.exportJob.deleteMany({ where: { userId: params.id } }),
  ]);
  await prisma.platformUser.delete({ where: { id: params.id } });

  const { ip, userAgent } = getRequestContext(request);
  await logAudit({
    actorUserId: session.user.id,
    actorPlatformRole: session.user.platformRole,
    action: AUDIT_ACTIONS.PLATFORM_USER_DELETED,
    targetType: "user",
    targetId: params.id,
    ip,
    userAgent,
    metadata: { deletedEmail: target.email, deletedName: target.name },
  });

  return NextResponse.json({ success: true });
}
