import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards"

export async function GET(request: NextRequest) {
  const auth = await requireBusinessAuth(request)
  if (isGuardError(auth)) return auth
  const { businessId } = auth

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      bookingBuffer: true,
      bookingMinNotice: true,
      bookingMaxAdvance: true,
      gcalBlockExternal: true,
    },
  })
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(business)
}

export async function PATCH(request: NextRequest) {
  const auth = await requireBusinessAuth(request)
  if (isGuardError(auth)) return auth
  const { businessId } = auth

  const body = await request.json()
  const { bookingBuffer, bookingMinNotice, bookingMaxAdvance, gcalBlockExternal } = body

  const data: Record<string, unknown> = {}
  if (typeof bookingBuffer === "number") data.bookingBuffer = bookingBuffer
  if (typeof bookingMinNotice === "number") data.bookingMinNotice = bookingMinNotice
  if (typeof bookingMaxAdvance === "number") data.bookingMaxAdvance = bookingMaxAdvance
  if (typeof gcalBlockExternal === "boolean") data.gcalBlockExternal = gcalBlockExternal

  const updated = await prisma.business.update({
    where: { id: businessId },
    data,
    select: {
      bookingBuffer: true,
      bookingMinNotice: true,
      bookingMaxAdvance: true,
      gcalBlockExternal: true,
    },
  })

  return NextResponse.json(updated)
}
