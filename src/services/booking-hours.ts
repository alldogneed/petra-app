/**
 * Working hours — business weekly hours (AvailabilityRule) and per-item online-booking
 * hours (PriceListItem.bookingHours). Used by MCP (get/set_working_hours,
 * set_service_booking_hours). Pure rules live in src/lib/booking-hours.ts.
 */
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import {
  BookingHoursError,
  HHMM_RE,
  DAY_NAMES_HE,
  businessDay,
  normalizeBookingHours,
  parseStoredBookingHours,
  type BookingHours,
  type BusinessDayRule,
} from "@/lib/booking-hours"
import { ServiceError } from "@/services/types"

export interface WorkingHoursOverview {
  business: BusinessDayRule[] // 7 rows, Sun..Sat (rule or default)
  configured: boolean // false = the business never saved hours (defaults apply)
  breaks: Array<{ dayOfWeek: number; startTime: string; endTime: string; label: string | null }>
  items: Array<{
    id: string
    name: string
    category: string | null
    durationMinutes: number | null
    isBookableOnline: boolean
    hours: BookingHours | null
  }>
}

export async function getWorkingHoursOverview(businessId: string): Promise<WorkingHoursOverview> {
  const [rules, breaks, items] = await Promise.all([
    prisma.availabilityRule.findMany({
      where: { businessId },
      select: { dayOfWeek: true, isOpen: true, openTime: true, closeTime: true },
    }),
    prisma.availabilityBreak.findMany({
      where: { businessId },
      select: { dayOfWeek: true, startTime: true, endTime: true, label: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      take: 50,
    }),
    prisma.priceListItem.findMany({
      where: { businessId, isActive: true, type: "service" },
      select: { id: true, name: true, category: true, durationMinutes: true, isBookableOnline: true, bookingHours: true },
      orderBy: [{ isBookableOnline: "desc" }, { name: "asc" }],
      take: 100,
    }),
  ])
  return {
    business: [0, 1, 2, 3, 4, 5, 6].map((d) => businessDay(rules, d)),
    configured: rules.length > 0,
    breaks,
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      durationMinutes: i.durationMinutes,
      isBookableOnline: i.isBookableOnline,
      hours: parseStoredBookingHours(i.bookingHours),
    })),
  }
}

export interface DayInput {
  dayOfWeek: number
  isOpen: boolean
  openTime?: string
  closeTime?: string
}

/** Validates a partial list of business days (each day once). Throws ServiceError. */
export function validateBusinessDays(days: DayInput[]): BusinessDayRule[] {
  if (!days.length || days.length > 7) throw new ServiceError("יש לציין 1–7 ימים", "VALIDATION")
  const seen = new Set<number>()
  return days.map((d) => {
    if (!Number.isInteger(d.dayOfWeek) || d.dayOfWeek < 0 || d.dayOfWeek > 6) {
      throw new ServiceError("day_of_week חייב להיות 0 (ראשון) עד 6 (שבת)", "VALIDATION")
    }
    if (seen.has(d.dayOfWeek)) throw new ServiceError(`יום ${DAY_NAMES_HE[d.dayOfWeek]} מופיע פעמיים`, "VALIDATION")
    seen.add(d.dayOfWeek)
    if (d.isOpen) {
      if (!d.openTime || !d.closeTime || !HHMM_RE.test(d.openTime) || !HHMM_RE.test(d.closeTime)) {
        throw new ServiceError(`ביום ${DAY_NAMES_HE[d.dayOfWeek]} יש לציין open_time ו-close_time בפורמט HH:MM`, "VALIDATION")
      }
      if (d.openTime >= d.closeTime) {
        throw new ServiceError(`ביום ${DAY_NAMES_HE[d.dayOfWeek]} שעת הסגירה חייבת להיות אחרי שעת הפתיחה`, "VALIDATION")
      }
    }
    return {
      dayOfWeek: d.dayOfWeek,
      isOpen: d.isOpen,
      openTime: d.openTime && HHMM_RE.test(d.openTime) ? d.openTime : "09:00",
      closeTime: d.closeTime && HHMM_RE.test(d.closeTime) ? d.closeTime : "18:00",
    }
  })
}

/**
 * Upserts only the given days (same as POST /api/booking/availability). Days not
 * given keep their current rule. When the business had no rules at all, the other
 * days are written with their current defaults first, so they don't change.
 */
export async function setBusinessWeeklyHours(businessId: string, days: DayInput[]): Promise<BusinessDayRule[]> {
  const valid = validateBusinessDays(days)
  const existing = await prisma.availabilityRule.findMany({
    where: { businessId },
    select: { dayOfWeek: true, isOpen: true, openTime: true, closeTime: true },
  })
  const toWrite: BusinessDayRule[] = [...valid]
  if (existing.length === 0) {
    for (let d = 0; d < 7; d++) {
      if (!valid.some((v) => v.dayOfWeek === d)) toWrite.push(businessDay([], d))
    }
  }
  // Sequential (PgBouncer — no interactive transactions); ≤ 7 rows.
  for (const r of toWrite) {
    await prisma.availabilityRule.upsert({
      where: { businessId_dayOfWeek: { businessId, dayOfWeek: r.dayOfWeek } },
      create: { businessId, dayOfWeek: r.dayOfWeek, isOpen: r.isOpen, openTime: r.openTime, closeTime: r.closeTime },
      update: { isOpen: r.isOpen, openTime: r.openTime, closeTime: r.closeTime },
    })
  }
  const after = await prisma.availabilityRule.findMany({
    where: { businessId },
    select: { dayOfWeek: true, isOpen: true, openTime: true, closeTime: true },
  })
  return [0, 1, 2, 3, 4, 5, 6].map((d) => businessDay(after, d))
}

export async function findBusinessPriceItem(businessId: string, itemId: string) {
  const item = await prisma.priceListItem.findFirst({
    where: { id: itemId, businessId },
    select: { id: true, name: true, isActive: true, isBookableOnline: true, durationMinutes: true, bookingHours: true },
  })
  if (!item) throw new ServiceError("פריט מחירון לא נמצא", "NOT_FOUND")
  return item
}

/**
 * Sets (or clears with null) an item's own online-booking hours.
 * Days not listed are closed for this item.
 */
export async function setItemBookingHours(
  businessId: string,
  itemId: string,
  hoursInput: unknown,
): Promise<{ id: string; name: string; isBookableOnline: boolean; hours: BookingHours | null }> {
  await findBusinessPriceItem(businessId, itemId)
  let hours: BookingHours | null
  try {
    hours = normalizeBookingHours(hoursInput)
  } catch (e) {
    if (e instanceof BookingHoursError) throw new ServiceError(e.message, "VALIDATION")
    throw e
  }
  if (hours && !hours.some((d) => d.isOpen)) {
    throw new ServiceError("לפחות יום אחד צריך להיות פתוח (או use_business_hours=true)", "VALIDATION")
  }
  await prisma.priceListItem.updateMany({
    where: { id: itemId, businessId },
    data: { bookingHours: hours ? (hours as unknown as Prisma.InputJsonValue) : Prisma.DbNull },
  })
  const after = await findBusinessPriceItem(businessId, itemId)
  return { id: after.id, name: after.name, isBookableOnline: after.isBookableOnline, hours: parseStoredBookingHours(after.bookingHours) }
}
