import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getAvailableSlots } from "@/lib/slots"

// GET /api/book/[slug]/slots?serviceId=...&date=YYYY-MM-DD
// Public: returns available time slots
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { searchParams } = new URL(req.url)
  const serviceId = searchParams.get("serviceId")
  const date = searchParams.get("date") // YYYY-MM-DD in business's local timezone

  if (!serviceId || !date) {
    return NextResponse.json({ error: "serviceId and date are required" }, { status: 400 })
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

  // Verify service belongs to this business and is publicly bookable
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId: business.id, isPublicBookable: true, isActive: true },
  })

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 })
  }

  const slots = await getAvailableSlots(business.id, serviceId, date)

  return NextResponse.json({
    date,
    slots: slots.map((s) => ({
      time: s.time,
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
    })),
  })
}
