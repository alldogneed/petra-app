import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireTenantPermission, isGuardError, extractBusinessId } from "@/lib/auth-guards"
import { TENANT_PERMS } from "@/lib/permissions"
import { z } from "zod"

// DELETE /api/admin/blocks/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const businessId = await extractBusinessId(req)
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const guard = await requireTenantPermission(req, businessId, TENANT_PERMS.SETTINGS_WRITE)
  if (isGuardError(guard)) return guard

  const block = await prisma.availabilityBlock.findFirst({
    where: { id: params.id, businessId },
  })

  if (!block) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 })
  }

  await prisma.availabilityBlock.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

const BlockUpdateSchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  reason: z.string().optional(),
})

// PATCH /api/admin/blocks/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const businessId = await extractBusinessId(req)
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const guard = await requireTenantPermission(req, businessId, TENANT_PERMS.SETTINGS_WRITE)
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
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 })
  }

  const validationResult = BlockUpdateSchema.safeParse(body)
  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(err => err.message).join(", ")
    return NextResponse.json({ error: errorMessages }, { status: 400 })
  }

  const { startAt, endAt, reason } = validationResult.data

  const updated = await prisma.availabilityBlock.update({
    where: { id: params.id },
    data: {
      ...(startAt ? { startAt: new Date(startAt) } : {}),
      ...(endAt ? { endAt: new Date(endAt) } : {}),
      ...(reason !== undefined ? { reason } : {}),
    },
  })

  return NextResponse.json({ block: updated })
}
