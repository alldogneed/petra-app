import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireTenantPermission, isGuardError, requireBusinessAuth } from "@/lib/auth-guards"
import { TENANT_PERMS } from "@/lib/permissions"
import { z } from "zod"

// GET /api/admin/blocks?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const auth = await requireBusinessAuth(req)
  if (isGuardError(auth)) return auth
  const { businessId } = auth

  const guard = await requireTenantPermission(req, businessId, TENANT_PERMS.SETTINGS_WRITE)
  if (isGuardError(guard)) return guard

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const blocks = await prisma.availabilityBlock.findMany({
    where: {
      businessId,
      ...(from ? { endAt: { gte: new Date(from) } } : {}),
      ...(to ? { startAt: { lte: new Date(to + "T23:59:59Z") } } : {}),
    },
    orderBy: { startAt: "asc" },
  })

  return NextResponse.json({ blocks })
}

const BlockFormSchema = z.object({
  startAt: z.string({ required_error: "startAt is required" }).datetime(),
  endAt: z.string({ required_error: "endAt is required" }).datetime(),
  reason: z.string().optional(),
})

// POST /api/admin/blocks
// Body: { startAt: ISO, endAt: ISO, reason?: string }
export async function POST(req: NextRequest) {
  const auth = await requireBusinessAuth(req)
  if (isGuardError(auth)) return auth
  const { businessId } = auth

  const guard = await requireTenantPermission(req, businessId, TENANT_PERMS.SETTINGS_WRITE)
  if (isGuardError(guard)) return guard

  let body: any;
  try {
    body = await req.json()
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 })
  }

  const validationResult = BlockFormSchema.safeParse(body)
  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(err => err.message).join(", ")
    return NextResponse.json({ error: errorMessages }, { status: 400 })
  }

  const { startAt, endAt, reason } = validationResult.data

  const block = await prisma.availabilityBlock.create({
    data: {
      businessId,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      reason: reason ?? null,
    },
  })

  return NextResponse.json({ block }, { status: 201 })
}
