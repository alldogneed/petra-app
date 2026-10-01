export const dynamic = 'force-dynamic';
/**
 * PATCH /api/admin/[businessId]/members/[memberId]
 * Change role or deactivate/reactivate a member.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { TENANT_PERMS, CRITICAL_CAPABILITIES } from "@/lib/permissions";
import { canModifyTenantRole, type TenantRole } from "@/lib/permissions";
import { logAudit, getRequestContext, AUDIT_ACTIONS } from "@/lib/audit";
import { logActivity, ACTIVITY_ACTIONS } from "@/lib/activity-log";
import { ENTITY_TYPES } from "@/lib/activity-actions";
import { z } from "zod";

const CAPABILITY_KEYS = CRITICAL_CAPABILITIES.map((c) => c.key) as [string, ...string[]];

/** Order-insensitive comparison of two permissionOverrides maps. */
function sameOverrides(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => {
    const obj = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
    return JSON.stringify(Object.keys(obj).sort().map((k) => [k, obj[k]]));
  };
  return norm(a) === norm(b);
}

const PatchMemberSchema = z.object({
  role: z.enum(["owner", "manager", "user"]).optional(),
  isActive: z.boolean().optional(),
  // Per-member capability overrides — only the keys the owner UI offers
  permissionOverrides: z.record(z.enum(CAPABILITY_KEYS), z.boolean()).optional(),
}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: { businessId: string; memberId: string } }
) {
  const guard = await requireTenantPermission(
    request,
    params.businessId,
    TENANT_PERMS.USERS_WRITE
  );
  if (isGuardError(guard)) return guard;
  const { session, membership: actorMembership } = guard;

  const { ip, userAgent } = getRequestContext(request);

  let body: z.infer<typeof PatchMemberSchema>;
  try {
    body = PatchMemberSchema.parse(await request.json());
  } catch (_e: unknown) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const targetMember = await prisma.businessUser.findFirst({
    where: { id: params.memberId, businessId: params.businessId },
    include: { user: { select: { name: true } } },
  });

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Prevent modifying yourself
  if (targetMember.userId === session.user.id) {
    return NextResponse.json(
      { error: "Cannot modify your own membership" },
      { status: 400 }
    );
  }

  // Role hierarchy check: actor must have higher or equal privilege to modify
  if (!canModifyTenantRole(actorMembership.role, targetMember.role as TenantRole)) {
    return NextResponse.json(
      { error: "Cannot modify a member with higher privileges" },
      { status: 403 }
    );
  }

  // Only owner can grant owner role
  if (body.role === "owner" && actorMembership.role !== "owner") {
    return NextResponse.json(
      { error: "Only owner can assign owner role" },
      { status: 403 }
    );
  }

  // Only the owner may hand out or take away critical capabilities.
  if (body.permissionOverrides && actorMembership.role !== "owner") {
    return NextResponse.json(
      { error: "Only owner can change individual permissions" },
      { status: 403 }
    );
  }

  const { permissionOverrides, ...rest } = body;
  const updated = await prisma.businessUser.update({
    where: { id: params.memberId },
    data: {
      ...rest,
      ...(permissionOverrides !== undefined && { permissionOverrides }),
    },
  });

  let action = "TENANT_MEMBER_UPDATED";
  if ("role" in body && body.role !== targetMember.role) {
    action = AUDIT_ACTIONS.TENANT_MEMBER_ROLE_CHANGED;
  } else if (body.isActive === false) {
    action = AUDIT_ACTIONS.TENANT_MEMBER_DEACTIVATED;
  } else if (body.isActive === true) {
    action = AUDIT_ACTIONS.TENANT_MEMBER_REACTIVATED;
  }

  await logAudit({
    actorUserId: session.user.id,
    actorBusinessId: params.businessId,
    action,
    targetType: "user",
    targetId: targetMember.userId,
    ip,
    userAgent,
    metadata: {
      changes: body,
      previous: { role: targetMember.role, isActive: targetMember.isActive },
    },
  });

  // Activity log (ניהול ובקרה) — one row per kind of change, awaited (sensitive).
  // businessId comes from the guard-verified membership, not the URL.
  const activityActions: string[] = [];
  if (body.role !== undefined && body.role !== targetMember.role) {
    activityActions.push(ACTIVITY_ACTIONS.UPDATE_MEMBER_ROLE);
  }
  if (permissionOverrides !== undefined && !sameOverrides(permissionOverrides, targetMember.permissionOverrides)) {
    activityActions.push(ACTIVITY_ACTIONS.UPDATE_MEMBER_PERMISSIONS);
  }
  if (body.isActive !== undefined && body.isActive !== targetMember.isActive) {
    activityActions.push(body.isActive ? ACTIVITY_ACTIONS.ACTIVATE_MEMBER : ACTIVITY_ACTIONS.DEACTIVATE_MEMBER);
  }
  for (const activityAction of activityActions) {
    await logActivity(session.user.id, session.user.name, activityAction, {
      businessId: actorMembership.businessId,
      entityType: ENTITY_TYPES.MEMBER,
      entityId: targetMember.userId,
      entityLabel: targetMember.user?.name ?? null,
    });
  }

  return NextResponse.json(updated);
}
