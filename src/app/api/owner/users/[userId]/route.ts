/**
 * GET   /api/owner/users/[userId]  — user details
 * PATCH /api/owner/users/[userId]  — block/unblock, change role
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { PLATFORM_PERMS, PLATFORM_ROLES } from "@/lib/permissions";
import { logAudit, getRequestContext, AUDIT_ACTIONS } from "@/lib/audit";
import { deleteAllUserSessions } from "@/lib/session";
import { z } from "zod";

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.USERS_READ);
  if (isGuardError(guard)) return guard;

  const user = await prisma.platformUser.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      email: true,
      name: true,
      platformRole: true,
      isActive: true,
      twoFaEnabled: true,
      createdAt: true,
      updatedAt: true,
      businessMemberships: {
        include: {
          business: { select: { id: true, name: true, status: true } },
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(user);
}

const PatchUserSchema = z.object({
  isActive: z.boolean().optional(),
  platformRole: z.enum(["super_admin", "admin", "support"]).optional().nullable(),
  name: z.string().min(1).max(100).optional(),
}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.USERS_WRITE);
  if (isGuardError(guard)) return guard;
  const { session } = guard;

  const { ip, userAgent } = getRequestContext(request);

  // Prevent self-modification of role/active status
  if (params.userId === session.user.id) {
    return NextResponse.json(
      { error: "Cannot modify your own account via this endpoint" },
      { status: 400 }
    );
  }

  let body: z.infer<typeof PatchUserSchema>;
  try {
    body = PatchUserSchema.parse(await request.json());
  } catch (e: unknown) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const existing = await prisma.platformUser.findUnique({ where: { id: params.userId } });
  if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Only super_admin can grant super_admin role
  if (
    body.platformRole === PLATFORM_ROLES.SUPER_ADMIN &&
    session.user.platformRole !== PLATFORM_ROLES.SUPER_ADMIN
  ) {
    return NextResponse.json(
      { error: "Only super_admin can grant super_admin role" },
      { status: 403 }
    );
  }

  const updated = await prisma.platformUser.update({
    where: { id: params.userId },
    data: body,
    select: { id: true, email: true, name: true, platformRole: true, isActive: true },
  });

  // If blocking user, kill all their sessions
  if (body.isActive === false) {
    await deleteAllUserSessions(params.userId);
  }

  // Determine audit action
  let action = "PLATFORM_USER_UPDATED";
  if (body.isActive === false) action = AUDIT_ACTIONS.PLATFORM_USER_BLOCKED;
  else if (body.isActive === true) action = AUDIT_ACTIONS.PLATFORM_USER_UNBLOCKED;
  else if ("platformRole" in body) action = AUDIT_ACTIONS.PLATFORM_ROLE_CHANGED;

  await logAudit({
    actorUserId: session.user.id,
    actorPlatformRole: session.user.platformRole,
    action,
    targetType: "user",
    targetId: params.userId,
    ip,
    userAgent,
    metadata: { changes: body, previous: { isActive: existing.isActive, platformRole: existing.platformRole } },
  });

  return NextResponse.json(updated);
}
