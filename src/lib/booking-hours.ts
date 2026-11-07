/**
 * Per-service online-booking hours (client-safe, pure).
 *
 * A price-list item can carry its own weekly hours (`PriceListItem.bookingHours`).
 * When set they REPLACE the business hours for that item only — they may be wider
 * or narrower than the business hours. Blocks, breaks, existing bookings,
 * appointments and lead meetings still apply on top (src/lib/slots.ts).
 * null = the item follows the business hours (the default, unchanged behaviour).
 */

export interface DayHours {
  dayOfWeek: number // 0 = Sunday … 6 = Saturday
  isOpen: boolean
  openTime: string // "HH:mm" local business time
  closeTime: string // "HH:mm"
}

export type BookingHours = DayHours[]

/** The business-level rule shape (AvailabilityRule rows). */
export interface BusinessDayRule {
  dayOfWeek: number
  isOpen: boolean
  openTime: string
  closeTime: string
}

export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export const DAY_NAMES_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] as const
export const DAY_SHORT_HE = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"] as const

/** Default window when the business never configured a day (same as slots.ts). */
export function defaultBusinessDay(dayOfWeek: number): BusinessDayRule {
  return {
    dayOfWeek,
    isOpen: dayOfWeek <= 5,
    openTime: "09:00",
    closeTime: dayOfWeek === 5 ? "13:00" : "18:00",
  }
}

/** Business window for one weekday (rule row, else the default). */
export function businessDay(rules: BusinessDayRule[], dayOfWeek: number): BusinessDayRule {
  const r = rules.find((x) => x.dayOfWeek === dayOfWeek)
  return r
    ? { dayOfWeek, isOpen: r.isOpen, openTime: r.openTime, closeTime: r.closeTime }
    : defaultBusinessDay(dayOfWeek)
}

export class BookingHoursError extends Error {}

/**
 * Validates input from an API body / MCP call.
 * - `null` / `undefined` / `[]` → null (follow business hours)
 * - otherwise an array of days; missing days are filled as CLOSED, so the result
 *   always has exactly 7 rows ordered by dayOfWeek. Throws BookingHoursError.
 */
export function normalizeBookingHours(input: unknown): BookingHours | null {
  if (input === null || input === undefined) return null
  if (!Array.isArray(input)) throw new BookingHoursError("שעות הזמינות חייבות להיות רשימת ימים")
  if (input.length === 0) return null
  if (input.length > 7) throw new BookingHoursError("יותר מ-7 ימים בשעות הזמינות")

  const byDay = new Map<number, DayHours>()
  for (const raw of input) {
    if (!raw || typeof raw !== "object") throw new BookingHoursError("יום לא תקין בשעות הזמינות")
    const r = raw as Record<string, unknown>
    const dow = Number(r.dayOfWeek)
    if (!Number.isInteger(dow) || dow < 0 || dow > 6) throw new BookingHoursError("יום בשבוע חייב להיות 0–6")
    if (byDay.has(dow)) throw new BookingHoursError(`יום ${DAY_NAMES_HE[dow]} מופיע פעמיים`)
    const isOpen = r.isOpen !== false
    const openTime = typeof r.openTime === "string" ? r.openTime : ""
    const closeTime = typeof r.closeTime === "string" ? r.closeTime : ""
    if (isOpen) {
      if (!HHMM_RE.test(openTime) || !HHMM_RE.test(closeTime)) {
        throw new BookingHoursError(`שעה לא תקינה ביום ${DAY_NAMES_HE[dow]} (פורמט HH:MM)`)
      }
      if (openTime >= closeTime) {
        throw new BookingHoursError(`ביום ${DAY_NAMES_HE[dow]} שעת הסיום חייבת להיות אחרי שעת ההתחלה`)
      }
    }
    byDay.set(dow, {
      dayOfWeek: dow,
      isOpen,
      openTime: HHMM_RE.test(openTime) ? openTime : "09:00",
      closeTime: HHMM_RE.test(closeTime) ? closeTime : "18:00",
    })
  }
  const out: BookingHours = []
  for (let d = 0; d < 7; d++) {
    out.push(byDay.get(d) ?? { dayOfWeek: d, isOpen: false, openTime: "09:00", closeTime: "18:00" })
  }
  return out
}

/** Reads a stored JSON value defensively (bad rows → null = business hours). */
export function parseStoredBookingHours(value: unknown): BookingHours | null {
  try {
    return normalizeBookingHours(value)
  } catch {
    return null
  }
}

/**
 * The window that applies to one item on one weekday:
 * item hours when set, else the business hours.
 */
export function resolveDayWindow(
  businessRules: BusinessDayRule[],
  itemHours: BookingHours | null,
  dayOfWeek: number,
): BusinessDayRule {
  if (itemHours) {
    const d = itemHours.find((x) => x.dayOfWeek === dayOfWeek)
    if (d) return { dayOfWeek, isOpen: d.isOpen, openTime: d.openTime, closeTime: d.closeTime }
    return { dayOfWeek, isOpen: false, openTime: "09:00", closeTime: "18:00" }
  }
  return businessDay(businessRules, dayOfWeek)
}

/** Seven windows (Sun..Sat) for an item — used by the booking page's date picker. */
export function weeklyWindows(businessRules: BusinessDayRule[], itemHours: BookingHours | null): BusinessDayRule[] {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => resolveDayWindow(businessRules, itemHours, d))
}

/**
 * Short Hebrew summary, consecutive equal days grouped:
 * "א'–ה' 11:00–14:00 · ו'–ש' סגור".
 */
export function formatWeeklyHours(days: Array<Pick<DayHours, "dayOfWeek" | "isOpen" | "openTime" | "closeTime">>): string {
  const sorted = [...days].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  const label = (d: (typeof sorted)[number]) => (d.isOpen ? `${d.openTime}–${d.closeTime}` : "סגור")
  const groups: Array<{ from: number; to: number; text: string }> = []
  for (const d of sorted) {
    const text = label(d)
    const last = groups[groups.length - 1]
    if (last && last.text === text && last.to === d.dayOfWeek - 1) last.to = d.dayOfWeek
    else groups.push({ from: d.dayOfWeek, to: d.dayOfWeek, text })
  }
  return groups
    .map((g) => `${g.from === g.to ? DAY_SHORT_HE[g.from] : `${DAY_SHORT_HE[g.from]}–${DAY_SHORT_HE[g.to]}`} ${g.text}`)
    .join(" · ")
}

/** Seed for the editor: copy of the business hours as 7 editable rows. */
export function hoursFromBusiness(businessRules: BusinessDayRule[]): BookingHours {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => {
    const b = businessDay(businessRules, d)
    return { dayOfWeek: d, isOpen: b.isOpen, openTime: b.openTime, closeTime: b.closeTime }
  })
}

/**
 * Online-booking type of a price-list item. Category "פנסיון" without a duration
 * = a boarding stay (date range). A "פנסיון" item WITH a duration (e.g. a 30-min
 * meet-and-greet) is a regular time slot. Shared by GET /api/book/[slug] and the
 * booking POST so the page and the server agree.
 */
export function isBoardingStayItem(item: { category: string | null; durationMinutes: number | null }): boolean {
  return item.category === "פנסיון" && !item.durationMinutes
}
