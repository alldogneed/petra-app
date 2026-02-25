/**
 * GET  /api/admin/[businessId]/members  — list members of a business
 * POST /api/admin/[businessId]/members  — invite a new member
 * Requires: tenant.users.read / tenant.users.write
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { TENANT_PERMS } from "@/lib/permissions";
import { logAudit, getRequestContext, AUDIT_ACTIONS } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { z } from "zod";

export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  const guard = await requireTenantPermission(
    request,
    params.businessId,
    TENANT_PERMS.USERS_READ
  );
  if (isGuardError(guard)) return guard;

  const members = await prisma.businessUser.findMany({
    where: { businessId: params.businessId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          platformRole: true,
          isActive: true,
          twoFaEnabled: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
}

const InviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(["owner", "manager", "user"]).default("user"),
  // If user doesn't exist yet, create with temp password
  temporaryPassword: z.string().min(8).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  const guard = await requireTenantPermission(
    request,
    params.businessId,
    TENANT_PERMS.USERS_WRITE
  );
  if (isGuardError(guard)) return guard;
  const { session, membership } = guard;

  const { ip, userAgent } = getRequestContext(request);

  // Only owner can invite another owner
  if (membership.role !== "owner") {
    if (/* inviting as owner */ false) { // checked in next block
      return NextResponse.json({ error: "Only owner can invite as owner" }, { status: 403 });
    }
  }

  let body: z.infer<typeof InviteSchema>;
  try {
    body = InviteSchema.parse(await request.json());
  } catch (e: unknown) {
    const zodError = e as { errors?: unknown };
    return NextResponse.json({ error: "Invalid request", details: zodError.errors }, { status: 400 });
  }

  // Owner role can only be granted by current owner
  if (body.role === "owner" && membership.role !== "owner") {
    return NextResponse.json(
      { error: "Only owner can invite another owner" },
      { status: 403 }
    );
  }

  // Find or create platform user
  let platformUser = await prisma.platformUser.findUnique({ where: { email: body.email } });
  if (!platformUser) {
    if (!body.temporaryPassword) {
      return NextResponse.json(
        { error: "User not found. Provide temporaryPassword to create account." },
        { status: 404 }
      );
    }
    const passwordHash = await bcrypt.hash(body.temporaryPassword, 12);
    platformUser = await prisma.platformUser.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash,
        isActive: true,
      },
    });
  }

  // Check if already a member
  const existing = await prisma.businessUser.findUnique({
    where: { businessId_userId: { businessId: params.businessId, userId: platformUser.id } },
  });

  if (existing) {
    if (existing.isActive) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }
    // Reactivate
    const updated = await prisma.businessUser.update({
      where: { id: existing.id },
      data: { isActive: true, role: body.role },
    });
    await logAudit({
      actorUserId: session.user.id,
      actorBusinessId: params.businessId,
      action: AUDIT_ACTIONS.TENANT_MEMBER_REACTIVATED,
      targetType: "user",
      targetId: platformUser.id,
      ip,
      userAgent,
      metadata: { role: body.role },
    });
    return NextResponse.json(updated, { status: 200 });
  }

  const member = await prisma.businessUser.create({
    data: {
      businessId: params.businessId,
      userId: platformUser.id,
      role: body.role,
      isActive: true,
    },
  });

  await logAudit({
    actorUserId: session.user.id,
    actorBusinessId: params.businessId,
    action: AUDIT_ACTIONS.TENANT_MEMBER_INVITED,
    targetType: "user",
    targetId: platformUser.id,
    ip,
    userAgent,
    metadata: { email: body.email, role: body.role },
  });

  return NextResponse.json({ member, user: platformUser }, { status: 201 });
}
