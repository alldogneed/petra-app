import { Prisma } from "@prisma/client"
import { BookingHoursError, normalizeBookingHours } from "@/lib/booking-hours"

/**
 * Turns `body.bookingHours` into a Prisma write value (server only).
 * undefined → field not touched; null / [] → DbNull (follow business hours).
 */
export function bookingHoursWrite(
  input: unknown,
): { ok: true; value: Prisma.InputJsonValue | typeof Prisma.DbNull | undefined } | { ok: false; error: string } {
  if (input === undefined) return { ok: true, value: undefined }
  try {
    const hours = normalizeBookingHours(input)
    return { ok: true, value: hours ? (hours as unknown as Prisma.InputJsonValue) : Prisma.DbNull }
  } catch (e) {
    if (e instanceof BookingHoursError) return { ok: false, error: e.message }
    throw e
  }
}
