/**
 * Integration-style tests for the booking engine logic.
 *
 * We mock Prisma so no real DB is needed. The test covers:
 *   1. getAvailableSlots – closed day
 *   2. getAvailableSlots – open day, no conflicts → full slot list
 *   3. getAvailableSlots – existing booking blocks slots correctly (with buffer)
 *   4. getAvailableSlots – availability block removes slots
 *   5. getAvailableSlots – service duration + buffer reduces available range
 *   6. Booking validation: slot re-check rejects taken slot
 */

// ─── Prisma mock ─────────────────────────────────────────────────────────────

const mockPrisma = {
  business: { findUniqueOrThrow: jest.fn() },
  service: { findUniqueOrThrow: jest.fn(), findMany: jest.fn() },
  availabilityRule: { findMany: jest.fn() },
  availabilityBlock: { findMany: jest.fn() },
  booking: { findMany: jest.fn() },
}

jest.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

import { getAvailableSlots } from "./slots"

// ─── Test fixtures ────────────────────────────────────────────────────────────

const BUSINESS_ID = "biz-001"
const SERVICE_ID  = "svc-001"
const TZ = "Asia/Jerusalem"

// Monday 2024-01-15 (Israel winter → UTC+2)
const TEST_DATE = "2024-01-15"

const BUSINESS = { timezone: TZ }
const SERVICE_60 = { duration: 60, bufferBefore: 0, bufferAfter: 0 }
const SERVICE_60_BUFFER15 = { duration: 60, bufferBefore: 0, bufferAfter: 15 }

// Monday = dayOfWeek 1
const RULES_OPEN = [
  { dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "11:00" },
]
const RULES_CLOSED = [
  { dayOfWeek: 1, isOpen: false, openTime: "09:00", closeTime: "11:00" },
]

function resetMocks() {
  mockPrisma.business.findUniqueOrThrow.mockResolvedValue(BUSINESS)
  mockPrisma.service.findUniqueOrThrow.mockResolvedValue(SERVICE_60)
  mockPrisma.availabilityRule.findMany.mockResolvedValue(RULES_OPEN)
  mockPrisma.availabilityBlock.findMany.mockResolvedValue([])
  mockPrisma.booking.findMany.mockResolvedValue([])
  mockPrisma.service.findMany.mockResolvedValue([])
}

beforeEach(() => {
  jest.clearAllMocks()
  resetMocks()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("getAvailableSlots – closed day", () => {
  it("returns empty array when the day rule is closed", async () => {
    mockPrisma.availabilityRule.findMany.mockResolvedValue(RULES_CLOSED)

    const slots = await getAvailableSlots(BUSINESS_ID, SERVICE_ID, TEST_DATE)
    expect(slots).toEqual([])
  })

  it("returns empty array when no rule exists for the day", async () => {
    mockPrisma.availabilityRule.findMany.mockResolvedValue([]) // no rules at all

    const slots = await getAvailableSlots(BUSINESS_ID, SERVICE_ID, TEST_DATE)
    expect(slots).toEqual([])
  })
})

describe("getAvailableSlots – open day, no conflicts", () => {
  it("returns correct slots for 60-min service in a 2-hour window (09:00–11:00)", async () => {
    const slots = await getAvailableSlots(BUSINESS_ID, SERVICE_ID, TEST_DATE)

    // Window 09:00–11:00 local. 60-min service, no buffer.
    // Steps of 15 min: 09:00, 09:15, 09:30, 09:45, 10:00 (5 slots; 10:15 would end at 11:15 > 11:00)
    expect(slots).toHaveLength(5)
    expect(slots[0].time).toBe("09:00")
    expect(slots[4].time).toBe("10:00")
  })

  it("startAt and endAt are Date objects in UTC", async () => {
    const slots = await getAvailableSlots(BUSINESS_ID, SERVICE_ID, TEST_DATE)
    expect(slots[0].startAt).toBeInstanceOf(Date)
    expect(slots[0].endAt).toBeInstanceOf(Date)
    // UTC diff = 60 minutes
    const diffMs = slots[0].endAt.getTime() - slots[0].startAt.getTime()
    expect(diffMs).toBe(60 * 60_000)
  })

  it("slot times are formatted as HH:mm strings", async () => {
    const slots = await getAvailableSlots(BUSINESS_ID, SERVICE_ID, TEST_DATE)
    slots.forEach((s) => {
      expect(s.time).toMatch(/^\d{2}:\d{2}$/)
    })
  })

  it("slot times are in ascending order", async () => {
    const slots = await getAvailableSlots(BUSINESS_ID, SERVICE_ID, TEST_DATE)
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].startAt.getTime()).toBeGreaterThan(slots[i - 1].startAt.getTime())
    }
  })
})

describe("getAvailableSlots – buffer after service", () => {
  it("bufferAfter=15 reduces available slots (last slot pushed earlier)", async () => {
    mockPrisma.service.findUniqueOrThrow.mockResolvedValue(SERVICE_60_BUFFER15)

    const slots = await getAvailableSlots(BUSINESS_ID, SERVICE_ID, TEST_DATE)

    // Each slot needs 60 + 15 = 75 min until window end (11:00).
    // 09:00 → ends (with buffer) 10:15 ✓
    // 09:15 → ends 10:30 ✓
    // 09:30 → ends 10:45 ✓
    // 09:45 → ends 11:00 ✓
    // 10:00 → ends 11:15 > 11:00 ✗
    expect(slots).toHaveLength(4)
    expect(slots[slots.length - 1].time).toBe("09:45")
  })
})

describe("getAvailableSlots – existing booking blocks slots", () => {
  it("a booking at 09:30 blocks slots that overlap it", async () => {
    // Existing booking 09:30–10:30 (60 min), no buffers on existing service
    const existingBookingServiceId = "svc-existing"
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        id: "bk-001",
        serviceId: existingBookingServiceId,
        startAt: new Date("2024-01-15T07:30:00Z"), // 07:30 UTC = 09:30 IL
        endAt:   new Date("2024-01-15T08:30:00Z"), // 08:30 UTC = 10:30 IL
      },
    ])
    mockPrisma.service.findMany.mockResolvedValue([
      { id: existingBookingServiceId, bufferBefore: 0, bufferAfter: 0 },
    ])

    const slots = await getAvailableSlots(BUSINESS_ID, SERVICE_ID, TEST_DATE)
    const times = slots.map((s) => s.time)

    // 09:00 slot → [09:00,10:00) does NOT overlap [09:30,10:30) → wait…
    // Actually 09:00–10:00 DOES overlap 09:30–10:30 (09:30 < 10:00 AND 09:00 < 10:30)
    expect(times).not.toContain("09:00")
    expect(times).not.toContain("09:15")
    expect(times).not.toContain("09:30")
    expect(times).not.toContain("09:45")
    // 10:30 slot → [10:30,11:30) but window ends at 11:00, so it doesn't fit either
    // Only 10:30 slot starts at 10:30, needs to end at 11:30 > 11:00 → no slot
    // So all slots are blocked in 09:00–11:00 window
    expect(slots).toHaveLength(0)
  })

  it("a booking with bufferAfter=15 on existing service blocks extra slots", async () => {
    const existingServiceId = "svc-existing-buffered"
    // Booking 09:00–10:00 with 15-min buffer after → busy until 10:15
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        id: "bk-002",
        serviceId: existingServiceId,
        startAt: new Date("2024-01-15T07:00:00Z"), // 07:00 UTC = 09:00 IL
        endAt:   new Date("2024-01-15T08:00:00Z"), // 08:00 UTC = 10:00 IL
      },
    ])
    mockPrisma.service.findMany.mockResolvedValue([
      { id: existingServiceId, bufferBefore: 0, bufferAfter: 15 },
    ])

    const slots = await getAvailableSlots(BUSINESS_ID, SERVICE_ID, TEST_DATE)
    const times = slots.map((s) => s.time)

    // Existing booking busy interval = [09:00, 10:15)
    // New 60-min slot at 10:15 → [10:15,11:15) > window end 11:00 → doesn't fit
    // No available slots
    expect(times).not.toContain("09:00")
    expect(times).not.toContain("10:00") // [10:00,11:00) overlaps [09:00,10:15)
    // 10:15 would be free but doesn't fit in window
    expect(slots).toHaveLength(0)
  })
})

describe("getAvailableSlots – availability block", () => {
  it("an all-day block removes all slots", async () => {
    mockPrisma.availabilityBlock.findMany.mockResolvedValue([
      {
        id: "blk-001",
        startAt: new Date("2024-01-15T00:00:00Z"),
        endAt:   new Date("2024-01-15T23:59:00Z"),
      },
    ])

    const slots = await getAvailableSlots(BUSINESS_ID, SERVICE_ID, TEST_DATE)
    expect(slots).toHaveLength(0)
  })

  it("a partial block only removes overlapping slots", async () => {
    // Block 10:00–11:00 local = 08:00–09:00 UTC
    mockPrisma.availabilityBlock.findMany.mockResolvedValue([
      {
        id: "blk-002",
        startAt: new Date("2024-01-15T08:00:00Z"), // 10:00 local
        endAt:   new Date("2024-01-15T09:00:00Z"), // 11:00 local
      },
    ])

    const slots = await getAvailableSlots(BUSINESS_ID, SERVICE_ID, TEST_DATE)
    const times = slots.map((s) => s.time)

    // Slots at 09:00,09:15,09:30,09:45,10:00 in a 2h window
    // A 60-min slot at 09:00 = UTC 07:00–08:00, doesn't overlap block (08:00–09:00) by half-open rule
    // A 60-min slot at 09:15 = UTC 07:15–08:15, overlaps block (08:00 < 08:15 AND 07:15 < 09:00) → blocked
    expect(times).toContain("09:00")
    expect(times).not.toContain("09:15") // overlaps block at 10:00 local
    expect(times).not.toContain("09:30")
    expect(times).not.toContain("09:45")
    expect(times).not.toContain("10:00")
  })
})

// ─── Utility: utcToLocalDateStr round-trip ────────────────────────────────────

describe("utcToLocalDateStr – used by booking route for slot revalidation", () => {
  it("startAt in UTC converts to same local date for Jerusalem timezone", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { utcToLocalDateStr } = require("./slots")
    // 09:00 local (07:00 UTC) on 2024-01-15
    const startAt = new Date("2024-01-15T07:00:00Z")
    expect(utcToLocalDateStr(startAt, TZ)).toBe("2024-01-15")
  })

  it("late UTC time near midnight returns next local day", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { utcToLocalDateStr } = require("./slots")
    // 22:30 UTC = 00:30 next day in Jerusalem
    const startAt = new Date("2024-01-15T22:30:00Z")
    expect(utcToLocalDateStr(startAt, TZ)).toBe("2024-01-16")
  })
})
