export const dynamic = 'force-dynamic';
/**
 * PATCH  /api/owner/tenants/[tenantId]/members/[memberId]  — change role / toggle active
 * DELETE /api/owner/tenants/[tenantId]/members/[memberId]  — remove from business
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { PLATFORM_PERMS } from "@/lib/permissions";
import { z } from "zod";

const PatchSchema = z.object({
  role: z.enum(["owner", "manager", "user"]).optional(),
  isActive: z.boolean().optional(),
}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: { tenantId: string; memberId: string } }
) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.TENANTS_WRITE);
  if (isGuardError(guard)) return guard;

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const membership = await prisma.businessUser.findFirst({
    where: { id: params.memberId, businessId: params.tenantId },
  });
  if (!membership) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const updated = await prisma.businessUser.update({
    where: { id: params.memberId },
    data: {
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
    include: {
      user: { select: { id: true, email: true, name: true, isActive: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { tenantId: string; memberId: string } }
) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.TENANTS_WRITE);
  if (isGuardError(guard)) return guard;

  const membership = await prisma.businessUser.findFirst({
    where: { id: params.memberId, businessId: params.tenantId },
  });
  if (!membership) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Prevent deleting the only owner
  if (membership.role === "owner") {
    const ownerCount = await prisma.businessUser.count({
      where: { businessId: params.tenantId, role: "owner", isActive: true },
    });
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "לא ניתן להסיר את הבעלים היחיד" }, { status: 400 });
    }
  }

  await prisma.businessUser.delete({ where: { id: params.memberId } });
  return NextResponse.json({ success: true });
}
