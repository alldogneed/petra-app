import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/book/[slug]
// Public: returns business info + publicly bookable services
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const business = await prisma.business.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      logo: true,
      timezone: true,
      status: true,
      services: {
        where: { isPublicBookable: true, isActive: true },
        select: {
          id: true,
          name: true,
          type: true,
          duration: true,
          price: true,
          includesVat: true,
          description: true,
          color: true,
          depositRequired: true,
          depositAmount: true,
          bookingMode: true,
          paymentUrl: true,
        },
        orderBy: { name: "asc" },
      },
      availabilityRules: {
        orderBy: { dayOfWeek: "asc" },
      },
    },
  })

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 })
  }

  if (business.status !== "active") {
    return NextResponse.json({ error: "Business is not accepting bookings" }, { status: 403 })
  }

  return NextResponse.json({ business })
}
