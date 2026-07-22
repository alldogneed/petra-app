export const dynamic = 'force-dynamic';
// SCOPE: tenant-scoped BY DESIGN. Despite living under /api/admin, this route
// (and its siblings admin/bookings/[id], admin/blocks, admin/availability) is a
// BUSINESS self-service tool — "admin" here is the legacy sense of "business
// owner/admin", NOT the platform console. It uses requireBusinessAuth and only
// ever touches the CALLER'S OWN business's online bookings. Do NOT swap this for
// requirePlatformPermission: that would silently change the data it operates on.
// See the note in src/app/admin/bookings/page.tsx re: the misleading platform-
// dashboard link.
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards"

// GET /api/admin/bookings?status=pending&from=YYYY-MM-DD&to=YYYY-MM-DD&serviceId=...
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(req)
    if (isGuardError(authResult)) return authResult

    const businessId = authResult.businessId
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
        service:       { select: { id: true, name: true, duration: true, price: true, color: true } },
        priceListItem: { select: { id: true, name: true, durationMinutes: true, basePrice: true } },
        customer:      { select: { id: true, name: true, phone: true, email: true } },
        dogs: {
          include: {
            pet: { select: { id: true, name: true, breed: true } },
          },
        },
      },
      orderBy: { startAt: "asc" },
    })

    return NextResponse.json({ bookings })
  } catch (error) {
    console.error("GET /api/admin/bookings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
