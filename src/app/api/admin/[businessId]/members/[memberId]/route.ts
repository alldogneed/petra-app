export const dynamic = 'force-dynamic';
/**
 * PATCH /api/admin/[businessId]/members/[memberId]
 * Change role or deactivate/reactivate a member.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { TENANT_PERMS } from "@/lib/permissions";
import { canModifyTenantRole, type TenantRole } from "@/lib/permissions";
import { logAudit, getRequestContext, AUDIT_ACTIONS } from "@/lib/audit";
import { z } from "zod";

const PatchMemberSchema = z.object({
  role: z.enum(["owner", "manager", "user"]).optional(),
  isActive: z.boolean().optional(),
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

  const updated = await prisma.businessUser.update({
    where: { id: params.memberId },
    data: body,
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

  return NextResponse.json(updated);
}
