import {
  formatWeeklyHours,
  hoursFromBusiness,
  isBoardingStayItem,
  normalizeBookingHours,
  parseStoredBookingHours,
  resolveDayWindow,
  weeklyWindows,
  BookingHoursError,
} from "../booking-hours"

const BIZ = [
  { dayOfWeek: 0, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { dayOfWeek: 6, isOpen: false, openTime: "09:00", closeTime: "18:00" },
]

describe("normalizeBookingHours", () => {
  it("null / empty → null (business hours)", () => {
    expect(normalizeBookingHours(null)).toBeNull()
    expect(normalizeBookingHours(undefined)).toBeNull()
    expect(normalizeBookingHours([])).toBeNull()
  })
  it("fills missing days as closed, ordered Sun..Sat", () => {
    const h = normalizeBookingHours([{ dayOfWeek: 3, isOpen: true, openTime: "11:00", closeTime: "14:00" }])!
    expect(h).toHaveLength(7)
    expect(h.map((d) => d.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(h[3]).toEqual({ dayOfWeek: 3, isOpen: true, openTime: "11:00", closeTime: "14:00" })
    expect(h[0].isOpen).toBe(false)
  })
  it("rejects bad input", () => {
    expect(() => normalizeBookingHours("x")).toThrow(BookingHoursError)
    expect(() => normalizeBookingHours([{ dayOfWeek: 7, isOpen: false }])).toThrow(BookingHoursError)
    expect(() => normalizeBookingHours([{ dayOfWeek: 1, isOpen: true, openTime: "14:00", closeTime: "11:00" }])).toThrow(BookingHoursError)
    expect(() => normalizeBookingHours([{ dayOfWeek: 1, isOpen: true, openTime: "9:00", closeTime: "11:00" }])).toThrow(BookingHoursError)
    expect(() =>
      normalizeBookingHours([
        { dayOfWeek: 1, isOpen: false },
        { dayOfWeek: 1, isOpen: false },
      ])
    ).toThrow(BookingHoursError)
  })
  it("a closed day needs no times", () => {
    const h = normalizeBookingHours([{ dayOfWeek: 5, isOpen: false }])!
    expect(h[5].isOpen).toBe(false)
  })
  it("stored garbage reads as business hours", () => {
    expect(parseStoredBookingHours({ foo: 1 })).toBeNull()
  })
})

describe("resolveDayWindow", () => {
  it("no item hours → business rule, else default", () => {
    expect(resolveDayWindow(BIZ, null, 0)).toMatchObject({ isOpen: true, openTime: "09:00", closeTime: "18:00" })
    expect(resolveDayWindow(BIZ, null, 6).isOpen).toBe(false)
    expect(resolveDayWindow(BIZ, null, 5)).toMatchObject({ isOpen: true, openTime: "09:00", closeTime: "13:00" })
  })
  it("item hours replace business hours — can be wider", () => {
    const h = normalizeBookingHours([{ dayOfWeek: 0, isOpen: true, openTime: "08:00", closeTime: "20:00" }])!
    expect(resolveDayWindow(BIZ, h, 0)).toMatchObject({ isOpen: true, openTime: "08:00", closeTime: "20:00" })
    expect(resolveDayWindow(BIZ, h, 1).isOpen).toBe(false)
  })
  it("weeklyWindows returns 7", () => {
    expect(weeklyWindows(BIZ, null)).toHaveLength(7)
  })
})

describe("formatWeeklyHours", () => {
  it("groups consecutive equal days (the ticket's example)", () => {
    const h = normalizeBookingHours([0, 1, 2, 3, 4].map((d) => ({ dayOfWeek: d, isOpen: true, openTime: "11:00", closeTime: "14:00" })))!
    expect(formatWeeklyHours(h)).toBe("א'–ה' 11:00–14:00 · ו'–ש' סגור")
  })
  it("seed from business hours", () => {
    expect(hoursFromBusiness(BIZ)).toHaveLength(7)
  })
})

describe("isBoardingStayItem", () => {
  it("פנסיון without duration = stay; with duration = time slot", () => {
    expect(isBoardingStayItem({ category: "פנסיון", durationMinutes: null })).toBe(true)
    expect(isBoardingStayItem({ category: "פנסיון", durationMinutes: 30 })).toBe(false)
    expect(isBoardingStayItem({ category: "אילוף", durationMinutes: null })).toBe(false)
  })
})
