import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards"

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBusinessAuth(request)
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
