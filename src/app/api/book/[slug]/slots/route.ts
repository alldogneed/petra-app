export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getAvailableSlots } from "@/lib/slots"

// GET /api/book/[slug]/slots?priceListItemId=...&date=YYYY-MM-DD
// Public: returns available time slots
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { searchParams } = new URL(req.url)
    const priceListItemId = searchParams.get("priceListItemId")
    const date = searchParams.get("date") // YYYY-MM-DD in business's local timezone

    if (!priceListItemId || !date) {
      return NextResponse.json({ error: "priceListItemId and date are required" }, { status: 400 })
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { slug: params.slug },
      select: { id: true, status: true },
    })

    if (!business || business.status !== "active") {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    // Verify item belongs to this business and is active
    const item = await prisma.priceListItem.findFirst({
      where: { id: priceListItemId, businessId: business.id, isActive: true },
    })

    if (!item) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    const slots = await getAvailableSlots(business.id, item.durationMinutes ?? 60, date)

    // Capacity check: if maxBookingsPerDay is set, count confirmed bookings for this item on this date
    let capacityReached = false
    if (item.maxBookingsPerDay) {
      const dayStart = new Date(`${date}T00:00:00.000Z`)
      const dayEnd = new Date(`${date}T23:59:59.999Z`)
      const confirmedCount = await prisma.booking.count({
        where: {
          businessId: business.id,
          priceListItemId,
          status: { in: ["confirmed", "pending"] },
          startAt: { gte: dayStart, lte: dayEnd },
        },
      })
      if (confirmedCount >= item.maxBookingsPerDay) {
        capacityReached = true
      }
    }

    return NextResponse.json({
      date,
      capacityReached,
      slots: capacityReached ? [] : slots.map((s) => ({
        time: s.time,
        startAt: s.startAt.toISOString(),
        endAt: s.endAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("GET book/[slug]/slots error:", error)
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 })
  }
}
