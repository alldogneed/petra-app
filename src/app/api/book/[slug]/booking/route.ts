export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getAvailableSlots, utcToLocalDateStr } from "@/lib/slots"
import { z } from "zod"
import { rateLimit } from "@/lib/rate-limit"
import { sendWhatsAppMessage } from "@/lib/whatsapp"
import { toWhatsAppPhone } from "@/lib/utils"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://petra-app.vercel.app"

function notifyCustomerConfirmed(
  booking: { id: string; customerToken?: string | null },
  customer: { phone: string; name: string },
  service: { name: string },
  dateLabel: string,
  timeLabel: string,
) {
  if (!customer.phone) return
  const phone = toWhatsAppPhone(customer.phone)
  const myBookingUrl = booking.customerToken ? `${APP_URL}/my-booking/${booking.customerToken}` : ""
  const body = `שלום ${customer.name}! ✅ הזמנתך אושרה!\n\nשירות: ${service.name}\nתאריך: ${dateLabel}\nשעה: ${timeLabel}${myBookingUrl ? `\n\nלצפייה/ביטול ההזמנה:\n${myBookingUrl}` : ""}`
  sendWhatsAppMessage({ to: phone, body }).catch(console.error)
}

function notifyCustomerPending(
  booking: { id: string; customerToken?: string | null },
  customer: { phone: string; name: string },
  service: { name: string },
  dateLabel: string,
  timeLabel: string,
) {
  if (!customer.phone) return
  const phone = toWhatsAppPhone(customer.phone)
  const myBookingUrl = booking.customerToken ? `${APP_URL}/my-booking/${booking.customerToken}` : ""
  const body = `שלום ${customer.name}! ⏳ בקשת ההזמנה שלך התקבלה.\n\nשירות: ${service.name}\nתאריך: ${dateLabel}\nשעה: ${timeLabel}\n\nנחזור אליך עם אישור בהקדם.${myBookingUrl ? `\n\nלצפייה בהזמנה:\n${myBookingUrl}` : ""}`
  sendWhatsAppMessage({ to: phone, body }).catch(console.error)
}

function notifyOwnerNewPending(
  businessPhone: string | null | undefined,
  customerName: string,
  service: { name: string },
  dateLabel: string,
) {
  if (!businessPhone) return
  const phone = toWhatsAppPhone(businessPhone)
  const body = `🔔 הזמנה חדשה ממתינה לאישור!\n\nלקוח: ${customerName}\nשירות: ${service.name}\nתאריך: ${dateLabel}\n\nנא לאשר/לדחות בפנל הניהול.`
  sendWhatsAppMessage({ to: phone, body }).catch(console.error)
}

// Zod Schema for input validation
const DogSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  breed: z.string().optional(),
  age: z.string().optional(),
  sex: z.string().optional(),
  notes: z.string().optional(),
}).refine((d) => d.id || (d.name && d.name.trim().length > 0), {
  message: "שם הכלב הוא שדה חובה",
  path: ["name"],
})

const isValidDate = (s: string) => !isNaN(new Date(s).getTime())

const BookingSchema = z.object({
  priceListItemId: z.string({ required_error: "priceListItemId is required" }),
  startAt: z.string({ required_error: "startAt is required" })
    .refine(isValidDate, { message: "Invalid datetime format" }),
  checkoutAt: z.string()
    .refine(isValidDate, { message: "Invalid datetime format" })
    .optional(), // boarding only
  phone: z.string({ required_error: "phone is required" }).min(9).max(15),
  customerName: z.string().min(2, "שם באורך של לפחות 2 תווים").optional(),
  customerEmail: z.string().email("כתובת אימייל לא חוקית").optional().or(z.literal("")),
  customerNotes: z.string().optional(),
  customerAddress: z.string().optional(),
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
    priceListItemId,
    startAt: startAtStr, // ISO string
    checkoutAt: checkoutAtStr, // boarding only
    phone,
    customerName,
    customerEmail,
    customerNotes,
    customerAddress,
    dogs,
  } = validationResult.data

  const business = await prisma.business.findUnique({
    where: { slug: params.slug },
    select: { id: true, status: true, timezone: true, phone: true },
  })

  if (!business || business.status !== "active") {
    return NextResponse.json({ error: "Business not found" }, { status: 404 })
  }

  const item = await prisma.priceListItem.findFirst({
    where: { id: priceListItemId, businessId: business.id, isActive: true },
  })

  if (!item) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 })
  }

  const startAt = new Date(startAtStr)
  if (isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "Invalid startAt" }, { status: 400 })
  }

  const isBoarding = item.category === "פנסיון"
  const durationMinutes = item.durationMinutes ?? 60

  let endAt: Date
  if (isBoarding && checkoutAtStr) {
    endAt = new Date(checkoutAtStr)
    if (isNaN(endAt.getTime())) {
      return NextResponse.json({ error: "Invalid checkoutAt" }, { status: 400 })
    }
    if (endAt <= startAt) {
      return NextResponse.json({ error: "תאריך יציאה חייב להיות אחרי תאריך כניסה" }, { status: 400 })
    }
  } else {
    endAt = new Date(startAt.getTime() + durationMinutes * 60_000)
  }

  // For non-boarding services: re-validate the slot is still available (prevent double-booking)
  if (!isBoarding) {
    const localDate = utcToLocalDateStr(startAt, business.timezone)
    const availableSlots = await getAvailableSlots(business.id, durationMinutes, localDate)
    const slotStillFree = availableSlots.some(
      (s) => Math.abs(s.startAt.getTime() - startAt.getTime()) < 60_000
    )
    if (!slotStillFree) {
      return NextResponse.json({ error: "Time slot is no longer available" }, { status: 409 })
    }
  }

  // Normalize phone: strip non-digits, convert Israeli local (05x) → international (972x)
  // so that "+972501234567" and "0501234567" produce the same norm ("972501234567")
  const phoneNorm = (() => {
    const digits = phone.replace(/\D/g, "")
    if (digits.startsWith("0") && digits.length >= 9) return "972" + digits.slice(1)
    return digits
  })()

  // Use a transaction to atomically identify/create customer + create booking
  const result = await prisma.$transaction(async (tx) => {
    // Identify or create customer (unique by phone within business)
    // First try phoneNorm match; fall back to raw phone for manually-created customers (phoneNorm=null)
    let customer = await tx.customer.findFirst({
      where: { businessId: business.id, phoneNorm },
    })
    if (!customer) {
      customer = await tx.customer.findFirst({
        where: { businessId: business.id, phone },
      })
    }

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
          address: customerAddress ?? null,
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
        } else if (dog.name && dog.name.trim()) {
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
    // Boarding allows multiple concurrent stays, so skip this check for boarding
    if (!isBoarding) {
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
    }

    const status = "confirmed"

    const booking = await tx.booking.create({
      data: {
        businessId: business.id,
        priceListItemId,
        customerId: customer.id,
        startAt,
        endAt,
        status,
        dogs: {
          create: petIds.map((petId) => ({ petId })),
        },
        depositPaid: false,
      },
      select: { id: true, customerToken: true },
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

  const { booking, customer, status } = result as {
    booking: { id: string; customerToken?: string | null },
    customer: { id: string, phone: string, name: string },
    status: string,
  }

  // Build human-readable date/time labels for notifications
  const pad2 = (n: number) => n.toString().padStart(2, "0")
  const dateLabel = startAt.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  const timeLabel = `${pad2(startAt.getHours())}:${pad2(startAt.getMinutes())}`
  const serviceName = item.name

  // Auto-create linked record for automatically-confirmed bookings
  if (status === "confirmed") {
    // First pet from booking dogs (already created inside transaction)
    const bookingWithDogs = await prisma.booking.findUnique({
      where: { id: booking.id },
      select: { dogs: { select: { petId: true }, take: 1 } },
    })
    const firstPetId = bookingWithDogs?.dogs[0]?.petId ?? null

    if (isBoarding && firstPetId) {
      // For boarding: create a BoardingStay linked to this booking
      await prisma.boardingStay.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          petId: firstPetId,
          checkIn: startAt,
          checkOut: endAt,
          status: "reserved",
          bookingId: booking.id,
        },
      })
    } else {
      // For other services: create an Appointment
      const pad = (n: number) => n.toString().padStart(2, "0")
      const startTime = `${pad(startAt.getHours())}:${pad(startAt.getMinutes())}`
      const endTime = `${pad(endAt.getHours())}:${pad(endAt.getMinutes())}`
      const dateOnly = new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate())
      const existing = await prisma.appointment.findFirst({
        where: { businessId: business.id, customerId: customer.id, priceListItemId, date: dateOnly, startTime },
      })
      if (!existing) {
        await prisma.appointment.create({
          data: {
            businessId: business.id,
            customerId: customer.id,
            priceListItemId,
            petId: firstPetId,
            date: dateOnly,
            startTime,
            endTime,
            status: "scheduled",
          },
        })
      }
    }
    notifyCustomerConfirmed(booking, customer, { name: serviceName }, dateLabel, timeLabel)
  } else {
    notifyCustomerPending(booking, customer, { name: serviceName }, dateLabel, timeLabel)
    notifyOwnerNewPending(business.phone, customer.name, { name: serviceName }, dateLabel)
  }

  return NextResponse.json(
    {
      bookingId: booking.id,
      customerToken: booking.customerToken ?? null,
      status,
      message:
        status === "confirmed"
          ? "הזמנתך אושרה!"
          : "בקשת ההזמנה שלך התקבלה ותטופל בקרוב.",
    },
    { status: 201 }
  )
}
