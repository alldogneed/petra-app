export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireBusinessPermission, isGuardError } from "@/lib/auth-guards"
import { TENANT_PERMS } from "@/lib/permissions"

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBusinessPermission(request, TENANT_PERMS.AVAILABILITY_MANAGE)
  if (isGuardError(auth)) return auth
  const { businessId } = auth

  const existing = await prisma.availabilityBreak.findFirst({
    where: { id: params.id, businessId },
  })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.availabilityBreak.delete({ where: { id: params.id, businessId } })

  return NextResponse.json({ ok: true })
}
