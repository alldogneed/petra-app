export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { DEMO_BUSINESS_ID } from "@/lib/utils"
import { requireAuth, isGuardError } from "@/lib/auth-guards"

// GET /api/admin/bookings?status=pending&from=YYYY-MM-DD&to=YYYY-MM-DD&serviceId=...
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (isGuardError(authResult)) return authResult

  const businessId = DEMO_BUSINESS_ID
  const { searchParams } = new URL(req.url)
  const status    = searchParams.get("status")
  const from      = searchParams.get("from")
  const to        = searchParams.get("to")
  const serviceId = searchParams.get("serviceId")

  const bookings = await prisma.booking.findMany({
    where: {
      businessId,
      ...(status    ? { status } : {}),
      ...(serviceId ? { serviceId } : {}),
      ...(from      ? { startAt: { gte: new Date(from) } } : {}),
      ...(to        ? { startAt: { lte: new Date(to + "T23:59:59Z") } } : {}),
    },
    include: {
      service:  { select: { id: true, name: true, duration: true, price: true, color: true } },
      customer: { select: { id: true, name: true, phone: true, email: true } },
      dogs: {
        include: {
          pet: { select: { id: true, name: true, breed: true } },
        },
      },
    },
    orderBy: { startAt: "asc" },
  })

  return NextResponse.json({ bookings })
}
