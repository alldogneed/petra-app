export const dynamic = 'force-dynamic';
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
      boardingCheckInTime: true,
      boardingCheckOutTime: true,
      cancellationPolicy: true,
      bookingWelcomeText: true,
      depositInstructions: true,
      priceListItems: {
        where: { isActive: true, isBookableOnline: true },
        select: {
          id: true,
          name: true,
          category: true,
          durationMinutes: true,
          basePrice: true,
          description: true,
          depositRequired: true,
          depositAmount: true,
          paymentUrl: true,
        },
        orderBy: [{ category: "asc" }, { name: "asc" }],
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

  const CATEGORY_TO_TYPE: Record<string, string> = {
    "פנסיון": "boarding",
    "אילוף": "training",
    "טיפוח": "grooming",
    "מוצרים": "other",
  };

  // Map price list items to the service shape expected by the booking wizard
  const services = business.priceListItems.map((item) => ({
    id: item.id,
    name: item.name,
    type: CATEGORY_TO_TYPE[item.category ?? ""] ?? "service",
    duration: item.durationMinutes ?? (item.category === "פנסיון" ? null : 60),
    price: item.basePrice,
    description: item.description ?? null,
    color: null,
    depositRequired: item.depositRequired,
    depositAmount: item.depositAmount ?? null,
    bookingMode: "automatic",
    paymentUrl: item.paymentUrl ?? null,
  }))

  const { priceListItems: _unused, ...businessData } = business
  return NextResponse.json({ business: { ...businessData, services } })
}
