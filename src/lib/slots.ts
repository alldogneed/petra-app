/**
 * Slot Generation Engine
 *
 * Computes available booking slots for a business on a given date.
 *
 * Algorithm:
 * 1. Look up AvailabilityRule for the requested day-of-week → working window [open, close)
 * 2. Collect all AvailabilityBlocks that overlap the working window → blocked intervals
 * 3. Collect all existing Bookings (with buffers) that overlap the window → busy intervals
 * 4. Walk the working window in service.duration steps (using a slot interval of
 *    min(30, duration)), and for each candidate slot check:
 *    a. slot + duration + bufferAfter ≤ closeTime
 *    b. slot does NOT overlap any blocked or busy interval
 * 5. Return the list of available start times (HH:mm strings in the business's timezone).
 *
 * Timezone handling:
 * All DB times are stored in UTC. The working-hours strings (HH:mm) represent
 * local time in business.timezone. We convert to UTC for overlap comparisons.
 */

import { prisma } from "@/lib/prisma"

export interface SlotResult {
  time: string    // "HH:mm" in local business timezone
  startAt: Date   // UTC
  endAt: Date     // UTC
}

interface Interval {
  start: Date
  end: Date
}

/** Convert "HH:mm" + a Date (acting as the day) into a UTC Date, interpreting the
 *  time as being in the given IANA timezone (e.g. "Asia/Jerusalem"). */
function localTimeToUtc(hhmm: string, localDateStr: string, timezone: string): Date {
  const [h, m] = hhmm.split(":").map(Number)
  // Build a Date by formatting as if it were in the target timezone.
  // We do this by constructing the ISO string and letting Intl figure it out.
  const isoStr = `${localDateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`
  // Use the Intl.DateTimeFormat trick to find the UTC offset at that local datetime
  const dt = new Date(isoStr + "Z") // treat as UTC first
  const tzOffset = getUtcOffsetMs(dt, timezone)
  return new Date(dt.getTime() - tzOffset)
}

/** Returns the UTC offset in milliseconds for a given instant in a given timezone. */
function getUtcOffsetMs(utcInstant: Date, timezone: string): number {
  // Format the UTC instant as local time strings in the target timezone
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  const parts = fmt.formatToParts(utcInstant)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const localDt = new Date(
    Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"))
  )
  return localDt.getTime() - utcInstant.getTime()
}

/** Convert a UTC Date to "HH:mm" string in the given timezone. */
export function utcToLocalHHMM(utcDate: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(utcDate)
    .replace(/^24:/, "00:")
}

/** Convert a UTC Date to "YYYY-MM-DD" in the given timezone. */
export function utcToLocalDateStr(utcDate: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(utcDate) // en-CA gives YYYY-MM-DD
}

/** Check if two intervals overlap (half-open: [start, end)). */
function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end
}

/** Add minutes to a Date, returning a new Date. */
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export async function getAvailableSlots(
  businessId: string,
  duration: number,   // service/item duration in minutes
  localDateStr: string, // "YYYY-MM-DD" in business timezone
  bufferBefore = 0,
  bufferAfter = 0,
): Promise<SlotResult[]> {
  // 1. Load business, availability rule, blocks, and existing bookings in parallel
  const [business, rules, blocks, existingBookings] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { timezone: true } }),
    prisma.availabilityRule.findMany({ where: { businessId } }),
    // Blocks that could possibly touch our target day (fetch ± 1 day in UTC to be safe)
    prisma.availabilityBlock.findMany({
      where: {
        businessId,
        startAt: { lte: new Date(`${localDateStr}T23:59:59Z`) },
        endAt:   { gte: new Date(`${localDateStr}T00:00:00Z`) },
      },
    }),
    // Bookings (active) that could touch our target day
    prisma.booking.findMany({
      where: {
        businessId,
        status: { in: ["confirmed", "pending"] },
        startAt: { lte: new Date(`${localDateStr}T23:59:59Z`) },
        endAt:   { gte: new Date(`${localDateStr}T00:00:00Z`) },
      },
    }),
  ])

  const { timezone } = business

  // 2. Find day-of-week rule. localDateStr is YYYY-MM-DD; parse to get local day.
  // We must interpret the day-of-week in the business timezone.
  const dayDate = new Date(`${localDateStr}T12:00:00Z`) // noon UTC, safe for tz shift
  const localDayOfWeek = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  })
    .formatToParts(dayDate)
    .find((p) => p.type === "weekday")?.value

  const DOW_MAP: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  const dayOfWeek = DOW_MAP[localDayOfWeek ?? "Sun"] ?? 0

  const rule = rules.find((r) => r.dayOfWeek === dayOfWeek)

  // Default when no availability rules are configured:
  // Open Sunday–Thursday (Israeli work week 0–4), closed Friday (5) & Saturday (6)
  const isOpen = rule ? rule.isOpen : dayOfWeek <= 4
  if (!isOpen) return []

  const openTime  = rule?.openTime  ?? "09:00"
  const closeTime = rule?.closeTime ?? "18:00"

  // 3. Convert working window to UTC
  const windowStart = localTimeToUtc(openTime, localDateStr, timezone)
  const windowEnd   = localTimeToUtc(closeTime, localDateStr, timezone)

  // 4. Build busy intervals from blocks and existing bookings (including buffers)
  // For legacy service-based bookings, look up their buffer values.
  const uniqueServiceIds = Array.from(
    new Set(existingBookings.map((b) => b.serviceId).filter((id): id is string => id !== null))
  )
  const existingServices = uniqueServiceIds.length > 0
    ? await prisma.service.findMany({
        where: { id: { in: uniqueServiceIds } },
        select: { id: true, bufferBefore: true, bufferAfter: true },
      })
    : []
  const svcMap = Object.fromEntries(existingServices.map((s) => [s.id, s]))

  const busyFromBookings: Interval[] = existingBookings.map((bk) => {
    const svc = bk.serviceId ? svcMap[bk.serviceId] : null
    return {
      start: addMinutes(bk.startAt, -(svc?.bufferBefore ?? 0)),
      end:   addMinutes(bk.endAt,    svc?.bufferAfter ?? 0),
    }
  })

  const allBusy: Interval[] = [
    ...blocks.map((b) => ({ start: b.startAt, end: b.endAt })),
    ...busyFromBookings,
  ]

  // 5. Walk the window in 15-minute steps (or service duration, whichever is smaller)
  const STEP = 15 // minutes
  const slots: SlotResult[] = []
  let cursor = windowStart

  while (cursor < windowEnd) {
    // The slot starts after bufferBefore, so actual service start = cursor
    const serviceStart = cursor
    const serviceEnd   = addMinutes(serviceStart, duration)
    const slotEnd      = addMinutes(serviceEnd, bufferAfter) // end including after-buffer

    // Must fit within working window
    if (slotEnd > windowEnd) break

    // Check collision against all busy intervals
    const slotInterval: Interval = { start: cursor, end: slotEnd }
    const isBusy = allBusy.some((b) => overlaps(slotInterval, b))

    if (!isBusy) {
      slots.push({
        time:    utcToLocalHHMM(serviceStart, timezone),
        startAt: serviceStart,
        endAt:   serviceEnd,
      })
    }

    cursor = addMinutes(cursor, STEP)
  }

  return slots
}
