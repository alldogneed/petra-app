export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireTenantPermission, isGuardError, requireBusinessAuth } from "@/lib/auth-guards"
import { TENANT_PERMS } from "@/lib/permissions"
import { z } from "zod"
import { BLOCK_USER_INCLUDE } from "@/lib/availability-block-range"
import { resolveMemberId } from "@/services/team-members"
import { ServiceError } from "@/services/types"

// DELETE /api/admin/blocks/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBusinessAuth(req)
  if (isGuardError(auth)) return auth
  const { businessId } = auth

  const guard = await requireTenantPermission(req, businessId, TENANT_PERMS.AVAILABILITY_MANAGE)
  if (isGuardError(guard)) return guard

  const block = await prisma.availabilityBlock.findFirst({
    where: { id: params.id, businessId },
  })

  if (!block) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 })
  }

  await prisma.availabilityBlock.delete({ where: { id: params.id, businessId } })
  return NextResponse.json({ ok: true })
}

const BlockUpdateSchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  reason: z.string().optional(),
  // null = whole business; a member id = that member's absence (א.40); omitted = unchanged
  userId: z.string().nullable().optional(),
})

// PATCH /api/admin/blocks/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBusinessAuth(req)
  if (isGuardError(auth)) return auth
  const { businessId } = auth

  const guard = await requireTenantPermission(req, businessId, TENANT_PERMS.AVAILABILITY_MANAGE)
  if (isGuardError(guard)) return guard

  const block = await prisma.availabilityBlock.findFirst({
    where: { id: params.id, businessId },
  })

  if (!block) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 })
  }

  let body: any;
  try {
    body = await req.json()
  } catch (_error) {
    return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 })
  }

  const validationResult = BlockUpdateSchema.safeParse(body)
  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(err => err.message).join(", ")
    return NextResponse.json({ error: errorMessages }, { status: 400 })
  }

  const { startAt, endAt, reason } = validationResult.data

  let userId: string | null | undefined
  if (validationResult.data.userId !== undefined) {
    try {
      userId = await resolveMemberId(businessId, validationResult.data.userId)
    } catch (error) {
      if (error instanceof ServiceError) return NextResponse.json({ error: error.message }, { status: 400 })
      throw error
    }
  }

  const updated = await prisma.availabilityBlock.update({
    where: { id: params.id, businessId },
    data: {
      ...(startAt ? { startAt: new Date(startAt) } : {}),
      ...(endAt ? { endAt: new Date(endAt) } : {}),
      ...(reason !== undefined ? { reason } : {}),
      ...(userId !== undefined ? { userId } : {}),
    },
    include: BLOCK_USER_INCLUDE,
  })

  return NextResponse.json({ block: updated })
}
