export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards"

// Stub notification
function notifyCustomer(booking: { id: string }, customer: { phone: string; name: string }, status: string) {
  console.log(`[NOTIFY] Booking ${booking.id} is now ${status} for ${customer.name} (${customer.phone})`)
}

// PATCH /api/admin/bookings/[id]
// Body: { action: "approve" | "decline" | "cancel", note?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(req)
  if (isGuardError(authResult)) return authResult

  const businessId = authResult.businessId
  const { action, note } = await req.json()

  if (!["approve", "decline", "cancel"].includes(action)) {
    return NextResponse.json({ error: "action must be approve, decline, or cancel" }, { status: 400 })
  }

  const booking = await prisma.booking.findFirst({
    where: { id: params.id, businessId },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      service:  { select: { id: true, name: true } },
    },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  const newStatus =
    action === "approve"  ? "confirmed" :
    action === "decline"  ? "declined"  :
                            "cancelled"

  const updated = await prisma.booking.update({
    where: { id: params.id },
    data: {
      status: newStatus,
      notes:  note ? `${booking.notes ?? ""}\n[Admin] ${note}`.trim() : booking.notes,
    },
  })

  // Notify customer
  notifyCustomer(updated, booking.customer, newStatus)

  return NextResponse.json({ booking: updated })
}

// GET /api/admin/bookings/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(req)
  if (isGuardError(authResult)) return authResult

  const businessId = authResult.businessId
  const booking = await prisma.booking.findFirst({
    where: { id: params.id, businessId },
    include: {
      service:  { select: { id: true, name: true, duration: true, price: true, color: true, bookingMode: true } },
      customer: { select: { id: true, name: true, phone: true, email: true } },
      dogs: {
        include: { pet: { select: { id: true, name: true, breed: true } } },
      },
    },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  return NextResponse.json({ booking })
}
