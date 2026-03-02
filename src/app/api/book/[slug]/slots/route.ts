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

  // Verify item belongs to this business and is bookable online
  const item = await prisma.priceListItem.findFirst({
    where: { id: priceListItemId, businessId: business.id, isBookableOnline: true, isActive: true },
  })

  if (!item) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 })
  }

  const slots = await getAvailableSlots(business.id, item.durationMinutes ?? 60, date)

  return NextResponse.json({
    date,
    slots: slots.map((s) => ({
      time: s.time,
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
    })),
  })
}
