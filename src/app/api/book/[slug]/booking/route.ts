import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getAvailableSlots, utcToLocalDateStr } from "@/lib/slots"
import { z } from "zod"
import { rateLimit } from "@/lib/rate-limit"

// Stub notification functions – replace with real integrations in production
function notifyCustomerConfirmed(booking: { id: string }, customer: { phone: string; name: string }) {
  console.log(`[NOTIFY] Booking ${booking.id} confirmed for ${customer.name} (${customer.phone})`)
}

function notifyCustomerPending(booking: { id: string }, customer: { phone: string; name: string }) {
  console.log(`[NOTIFY] Booking ${booking.id} pending approval for ${customer.name} (${customer.phone})`)
}

function notifyOwnerNewPending(booking: { id: string }, businessId: string) {
  console.log(`[NOTIFY] New pending booking ${booking.id} for business ${businessId}`)
}

// Zod Schema for input validation
const DogSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "שם הכלב הוא שדה חובה"),
  breed: z.string().optional(),
  age: z.string().optional(),
  sex: z.string().optional(),
  notes: z.string().optional(),
})

const BookingSchema = z.object({
  serviceId: z.string({ required_error: "serviceId is required" }),
  startAt: z.string({ required_error: "startAt is required" }).datetime({ message: "Invalid datetime format" }),
  phone: z.string({ required_error: "phone is required" }).min(9).max(15),
  customerName: z.string().min(2, "שם באורך של לפחות 2 תווים").optional(),
  customerEmail: z.string().email("כתובת אימייל לא חוקית").optional().or(z.literal("")),
  customerNotes: z.string().optional(),
  dogs: z.array(DogSchema).optional(),
})

// POST /api/book/[slug]/booking
// Public: identifies/creates customer, creates booking
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  // Rate Limiting
  const ip = req.headers.get("x-forwarded-for") || req.ip || "127.0.0.1"
  const rateLimitResult = rateLimit("public_booking", ip, { max: 5, windowMs: 60 * 1000 })
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": Math.ceil(rateLimitResult.retryAfterMs / 1000).toString() } }
    )
  }

  let body: any;
  try {
    body = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 })
  }

  // Zod Validation
  const validationResult = BookingSchema.safeParse(body)
  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(err => err.message).join(", ")
    return NextResponse.json({ error: errorMessages }, { status: 400 })
  }

  const {
    serviceId,
    startAt: startAtStr, // ISO string
    phone,
    customerName,
    customerEmail,
    customerNotes,
    dogs,
  } = validationResult.data

  const business = await prisma.business.findUnique({
    where: { slug: params.slug },
    select: { id: true, status: true, timezone: true },
  })

  if (!business || business.status !== "active") {
    return NextResponse.json({ error: "Business not found" }, { status: 404 })
  }

  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId: business.id, isPublicBookable: true, isActive: true },
  })

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 })
  }

  const startAt = new Date(startAtStr)
  if (isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "Invalid startAt" }, { status: 400 })
  }
  const endAt = new Date(startAt.getTime() + service.duration * 60_000)

  // Re-validate the slot is still available (prevent double-booking)
  const localDate = utcToLocalDateStr(startAt, business.timezone)
  const availableSlots = await getAvailableSlots(business.id, serviceId, localDate)
  const slotStillFree = availableSlots.some(
    (s) => Math.abs(s.startAt.getTime() - startAt.getTime()) < 60_000
  )
  if (!slotStillFree) {
    return NextResponse.json({ error: "Time slot is no longer available" }, { status: 409 })
  }

  // Normalize phone (remove spaces/dashes for uniqueness check)
  const phoneNorm = phone.replace(/[\s\-().+]/g, "")

  // Use a transaction to atomically identify/create customer + create booking
  const result = await prisma.$transaction(async (tx) => {
    // Identify or create customer (unique by phone within business)
    let customer = await tx.customer.findFirst({
      where: { businessId: business.id, phoneNorm },
    })

    if (!customer) {
      if (!customerName) {
        throw new Error("customerName is required for new customers")
      }
      customer = await tx.customer.create({
        data: {
          businessId: business.id,
          name: customerName,
          phone,
          phoneNorm,
          email: customerEmail ?? null,
          notes: customerNotes ?? null,
        },
      })
    }

    // Handle dogs: resolve existing or create new
    const petIds: string[] = []
    if (Array.isArray(dogs)) {
      for (const dog of dogs) {
        if (dog.id) {
          // Existing pet – verify it belongs to this customer
          const existing = await tx.pet.findFirst({
            where: { id: dog.id, customerId: customer.id },
          })
          if (existing) petIds.push(existing.id)
        } else {
          // Create new pet
          const newPet = await tx.pet.create({
            data: {
              customerId: customer.id,
              name: dog.name,
              breed: dog.breed ?? null,
              gender: dog.sex ?? null,
              behaviorNotes: dog.notes ?? null,
            },
          })
          petIds.push(newPet.id)
        }
      }
    }

    // Double-booking guard: check inside transaction with a unique-ish approach
    // (SQLite doesn't support SELECT FOR UPDATE, so we rely on the slot re-check above +
    //  the transaction serialization for the final insert)
    const conflict = await tx.booking.findFirst({
      where: {
        businessId: business.id,
        status: { in: ["confirmed", "pending"] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    })
    if (conflict) {
      throw new Error("SLOT_TAKEN")
    }

    const status = service.bookingMode === "automatic" ? "confirmed" : "pending"

    const booking = await tx.booking.create({
      data: {
        businessId: business.id,
        serviceId,
        customerId: customer.id,
        startAt,
        endAt,
        status,
        dogs: {
          create: petIds.map((petId) => ({ petId })),
        },
        depositPaid: false,
      },
    })

    return { booking, customer, status }
  }).catch((err: any) => {
    if (err.message === "SLOT_TAKEN") return null
    if (err.message === "customerName is required for new customers") return { validationError: err.message }
    // Catch Prisma unique constraint violation for double-booking
    if (err.code === "P2002" && err.meta?.target?.includes("startAt")) {
      return null
    }
    throw err
  })

  if (result === null) {
    return NextResponse.json({ error: "Time slot is no longer available" }, { status: 409 })
  }
  if (result && "validationError" in result) {
    return NextResponse.json({ error: result.validationError }, { status: 400 })
  }

  const { booking, customer, status } = result as { booking: { id: string }, customer: { phone: string, name: string }, status: string }

  // Send notifications (stubbed)
  if (status === "confirmed") {
    notifyCustomerConfirmed(booking, customer)
  } else {
    notifyCustomerPending(booking, customer)
    notifyOwnerNewPending(booking, business.id)
  }

  return NextResponse.json(
    {
      bookingId: booking.id,
      status,
      message:
        status === "confirmed"
          ? "הזמנתך אושרה!"
          : "בקשת ההזמנה שלך התקבלה ותטופל בקרוב.",
    },
    { status: 201 }
  )
}
