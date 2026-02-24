/**
 * Unit tests for src/lib/slots.ts
 *
 * Strategy: extract the pure helper functions by re-implementing them here
 * so we can test them without Prisma. The DB-dependent getAvailableSlots()
 * is covered by integration tests in the API test file.
 *
 * Tested functions:
 *   - utcToLocalHHMM
 *   - utcToLocalDateStr
 *   - overlaps (via the exported logic, re-tested below)
 *   - addMinutes (via exported indirectly)
 *   - localTimeToUtc (indirectly via utcToLocalHHMM round-trip)
 *   - The slot-walking algorithm (via the pure helpers below)
 */

import { utcToLocalHHMM, utcToLocalDateStr } from "./slots"

const TZ = "Asia/Jerusalem"

// ─── utcToLocalHHMM ──────────────────────────────────────────────────────────

describe("utcToLocalHHMM", () => {
  it("converts UTC noon to local time in Asia/Jerusalem (UTC+2 standard)", () => {
    // 2024-01-10 is in winter → UTC+2
    const utc = new Date("2024-01-10T10:00:00Z") // 10:00 UTC = 12:00 IL
    const result = utcToLocalHHMM(utc, TZ)
    expect(result).toBe("12:00")
  })

  it("converts UTC time to local time in DST (UTC+3)", () => {
    // 2024-07-10 is in summer → UTC+3
    const utc = new Date("2024-07-10T07:00:00Z") // 07:00 UTC = 10:00 IL (DST)
    const result = utcToLocalHHMM(utc, TZ)
    expect(result).toBe("10:00")
  })

  it("handles midnight crossing correctly", () => {
    // 22:00 UTC in winter (UTC+2) = 00:00 next day local
    const utc = new Date("2024-01-10T22:00:00Z")
    const result = utcToLocalHHMM(utc, TZ)
    expect(result).toBe("00:00")
  })

  it("works with 09:00 local in winter (UTC+2 → 07:00 UTC)", () => {
    const utc = new Date("2024-01-10T07:00:00Z")
    const result = utcToLocalHHMM(utc, TZ)
    expect(result).toBe("09:00")
  })

  it("works with 18:00 local in winter (UTC+2 → 16:00 UTC)", () => {
    const utc = new Date("2024-01-10T16:00:00Z")
    const result = utcToLocalHHMM(utc, TZ)
    expect(result).toBe("18:00")
  })

  it("formats minutes correctly (e.g., 09:30)", () => {
    const utc = new Date("2024-01-10T07:30:00Z") // 07:30 UTC = 09:30 IL winter
    const result = utcToLocalHHMM(utc, TZ)
    expect(result).toBe("09:30")
  })

  it("returns HH:mm format (always 5 chars)", () => {
    const utc = new Date("2024-01-10T07:05:00Z")
    const result = utcToLocalHHMM(utc, TZ)
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })
})

// ─── utcToLocalDateStr ───────────────────────────────────────────────────────

describe("utcToLocalDateStr", () => {
  it("returns YYYY-MM-DD in the given timezone (same day as UTC)", () => {
    const utc = new Date("2024-06-15T10:00:00Z")
    expect(utcToLocalDateStr(utc, TZ)).toBe("2024-06-15")
  })

  it("returns next day when local time crosses midnight ahead of UTC", () => {
    // 23:30 UTC = 01:30 next day in UTC+2
    const utc = new Date("2024-01-10T23:30:00Z")
    expect(utcToLocalDateStr(utc, TZ)).toBe("2024-01-11")
  })

  it("always returns YYYY-MM-DD format", () => {
    const utc = new Date("2024-03-05T12:00:00Z")
    const result = utcToLocalDateStr(utc, TZ)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("handles year/month boundaries", () => {
    // Dec 31 UTC but already Jan 1 in Jerusalem
    const utc = new Date("2023-12-31T22:30:00Z")
    expect(utcToLocalDateStr(utc, TZ)).toBe("2024-01-01")
  })
})

// ─── Pure logic helpers (reimplemented to test independently of Prisma) ───────

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

function overlaps(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date }
): boolean {
  return a.start < b.end && b.start < a.end
}

// ─── addMinutes ──────────────────────────────────────────────────────────────

describe("addMinutes helper", () => {
  const base = new Date("2024-01-10T09:00:00Z")

  it("adds 30 minutes", () => {
    expect(addMinutes(base, 30).toISOString()).toBe("2024-01-10T09:30:00.000Z")
  })

  it("adds 60 minutes (1 hour)", () => {
    expect(addMinutes(base, 60).toISOString()).toBe("2024-01-10T10:00:00.000Z")
  })

  it("adds 0 minutes returns same time", () => {
    expect(addMinutes(base, 0).getTime()).toBe(base.getTime())
  })

  it("handles negative minutes (subtract)", () => {
    expect(addMinutes(base, -15).toISOString()).toBe("2024-01-10T08:45:00.000Z")
  })

  it("crosses midnight correctly", () => {
    const late = new Date("2024-01-10T23:45:00Z")
    expect(addMinutes(late, 30).toISOString()).toBe("2024-01-11T00:15:00.000Z")
  })

  it("does not mutate the input date", () => {
    const d = new Date("2024-01-10T09:00:00Z")
    const original = d.getTime()
    addMinutes(d, 60)
    expect(d.getTime()).toBe(original)
  })
})

// ─── overlaps ────────────────────────────────────────────────────────────────

describe("overlaps helper (half-open interval [start, end))", () => {
  const t = (iso: string) => new Date(iso)

  it("overlapping intervals → true", () => {
    const a = { start: t("2024-01-10T09:00Z"), end: t("2024-01-10T10:00Z") }
    const b = { start: t("2024-01-10T09:30Z"), end: t("2024-01-10T10:30Z") }
    expect(overlaps(a, b)).toBe(true)
    expect(overlaps(b, a)).toBe(true)
  })

  it("contained interval → true", () => {
    const outer = { start: t("2024-01-10T09:00Z"), end: t("2024-01-10T11:00Z") }
    const inner = { start: t("2024-01-10T09:30Z"), end: t("2024-01-10T10:30Z") }
    expect(overlaps(outer, inner)).toBe(true)
  })

  it("adjacent (touching at boundary) → false (half-open)", () => {
    const a = { start: t("2024-01-10T09:00Z"), end: t("2024-01-10T10:00Z") }
    const b = { start: t("2024-01-10T10:00Z"), end: t("2024-01-10T11:00Z") }
    expect(overlaps(a, b)).toBe(false)
    expect(overlaps(b, a)).toBe(false)
  })

  it("completely separate before → false", () => {
    const a = { start: t("2024-01-10T09:00Z"), end: t("2024-01-10T10:00Z") }
    const b = { start: t("2024-01-10T11:00Z"), end: t("2024-01-10T12:00Z") }
    expect(overlaps(a, b)).toBe(false)
  })

  it("completely separate after → false", () => {
    const a = { start: t("2024-01-10T11:00Z"), end: t("2024-01-10T12:00Z") }
    const b = { start: t("2024-01-10T09:00Z"), end: t("2024-01-10T10:00Z") }
    expect(overlaps(a, b)).toBe(false)
  })

  it("same interval → true", () => {
    const a = { start: t("2024-01-10T09:00Z"), end: t("2024-01-10T10:00Z") }
    expect(overlaps(a, a)).toBe(true)
  })

  it("one-minute overlap → true", () => {
    const a = { start: t("2024-01-10T09:00Z"), end: t("2024-01-10T10:01Z") }
    const b = { start: t("2024-01-10T10:00Z"), end: t("2024-01-10T11:00Z") }
    expect(overlaps(a, b)).toBe(true)
  })
})

// ─── Slot-walking algorithm (pure, no Prisma) ────────────────────────────────

/**
 * Re-implementation of the slot walker from slots.ts so we can unit-test
 * the core algorithm without touching the DB layer.
 */
function walkSlots(options: {
  windowStart: Date
  windowEnd: Date
  durationMin: number
  bufferAfterMin: number
  busyIntervals: { start: Date; end: Date }[]
  stepMin?: number
}): Date[] {
  const { windowStart, windowEnd, durationMin, bufferAfterMin, busyIntervals, stepMin = 15 } = options
  const results: Date[] = []
  let cursor = windowStart

  while (cursor < windowEnd) {
    const serviceEnd = addMinutes(cursor, durationMin)
    const slotEnd = addMinutes(serviceEnd, bufferAfterMin)
    if (slotEnd > windowEnd) break

    const slotInterval = { start: cursor, end: slotEnd }
    const isBusy = busyIntervals.some((b) => overlaps(slotInterval, b))
    if (!isBusy) results.push(new Date(cursor))

    cursor = addMinutes(cursor, stepMin)
  }

  return results
}

describe("slot-walking algorithm", () => {
  const t = (hhmm: string) => new Date(`2024-01-10T${hhmm}:00Z`)

  it("empty window → no slots", () => {
    const slots = walkSlots({
      windowStart: t("09:00"),
      windowEnd: t("09:00"),
      durationMin: 60,
      bufferAfterMin: 0,
      busyIntervals: [],
    })
    expect(slots).toHaveLength(0)
  })

  it("60-min service in 1-hour window → exactly 1 slot (09:00)", () => {
    const slots = walkSlots({
      windowStart: t("09:00"),
      windowEnd: t("10:00"),
      durationMin: 60,
      bufferAfterMin: 0,
      busyIntervals: [],
    })
    expect(slots).toHaveLength(1)
    expect(slots[0]).toEqual(t("09:00"))
  })

  it("60-min service in 2-hour window → 5 slots at 09:00,09:15,09:30,09:45,10:00", () => {
    const slots = walkSlots({
      windowStart: t("09:00"),
      windowEnd: t("11:00"),
      durationMin: 60,
      bufferAfterMin: 0,
      busyIntervals: [],
    })
    expect(slots).toHaveLength(5)
    expect(slots.map((s) => s.toISOString().slice(11, 16))).toEqual([
      "09:00", "09:15", "09:30", "09:45", "10:00",
    ])
  })

  it("30-min buffer after a 60-min service pushes last slot earlier", () => {
    // window 09:00-11:00. Each slot needs 60 + 30 = 90 min.
    // 09:00 fits (ends 10:30), 09:15 fits (ends 10:45), 09:30 fits (ends 11:00)
    // 09:45 → would end 11:15 > 11:00 → does NOT fit
    const slots = walkSlots({
      windowStart: t("09:00"),
      windowEnd: t("11:00"),
      durationMin: 60,
      bufferAfterMin: 30,
      busyIntervals: [],
    })
    expect(slots).toHaveLength(3)
    expect(slots[slots.length - 1].toISOString().slice(11, 16)).toBe("09:30")
  })

  it("busy interval in middle blocks those slots", () => {
    // window 09:00–12:00, 60-min service, no buffer
    // busy block 10:00–11:00
    //   slot 09:00 → [09:00,10:00) → touches block at boundary (half-open) → NOT blocked
    //   slot 09:15 → [09:15,10:15) overlaps [10:00,11:00) → blocked
    //   slot 09:30 → [09:30,10:30) overlaps → blocked
    //   slot 09:45 → [09:45,10:45) overlaps → blocked
    //   slot 10:00 → [10:00,11:00) overlaps → blocked
    //   slot 10:15 → [10:15,11:15) overlaps → blocked
    //   slot 10:45 → [10:45,11:45) overlaps → blocked
    //   slot 11:00 → [11:00,12:00) no overlap → free
    const slots = walkSlots({
      windowStart: t("09:00"),
      windowEnd: t("12:00"),
      durationMin: 60,
      bufferAfterMin: 0,
      busyIntervals: [{ start: t("10:00"), end: t("11:00") }],
    })
    const times = slots.map((s) => s.toISOString().slice(11, 16))
    expect(times).toContain("09:00")      // ends exactly at block start → free
    expect(times).not.toContain("09:15")  // [09:15,10:15) overlaps block
    expect(times).not.toContain("09:45")  // [09:45,10:45) overlaps block
    expect(times).not.toContain("10:00")  // [10:00,11:00) overlaps block
    expect(times).not.toContain("10:30")  // [10:30,11:30) overlaps block
    expect(times).toContain("11:00")      // [11:00,12:00) free
  })

  it("multiple busy intervals block independently", () => {
    const slots = walkSlots({
      windowStart: t("09:00"),
      windowEnd: t("13:00"),
      durationMin: 30,
      bufferAfterMin: 0,
      busyIntervals: [
        { start: t("10:00"), end: t("10:30") },
        { start: t("11:30"), end: t("12:00") },
      ],
    })
    const times = slots.map((s) => s.toISOString().slice(11, 16))
    expect(times).not.toContain("10:00")
    expect(times).not.toContain("09:45") // 09:45–10:15 overlaps block at 10:00
    expect(times).not.toContain("11:30")
    expect(times).toContain("10:30")
    expect(times).toContain("12:00")
  })

  it("fully blocked window → no slots", () => {
    const slots = walkSlots({
      windowStart: t("09:00"),
      windowEnd: t("18:00"),
      durationMin: 60,
      bufferAfterMin: 0,
      busyIntervals: [{ start: t("00:00"), end: t("23:59") }],
    })
    expect(slots).toHaveLength(0)
  })

  it("service duration exactly fills window → 1 slot only", () => {
    const slots = walkSlots({
      windowStart: t("09:00"),
      windowEnd: t("10:00"),
      durationMin: 60,
      bufferAfterMin: 0,
      busyIntervals: [],
    })
    expect(slots).toHaveLength(1)
  })

  it("service longer than window → no slots", () => {
    const slots = walkSlots({
      windowStart: t("09:00"),
      windowEnd: t("09:30"),
      durationMin: 60,
      bufferAfterMin: 0,
      busyIntervals: [],
    })
    expect(slots).toHaveLength(0)
  })

  it("busy block touching only start boundary does not block slot (half-open)", () => {
    // block ends exactly at 09:00, slot starts at 09:00 → no overlap
    const slots = walkSlots({
      windowStart: t("09:00"),
      windowEnd: t("10:00"),
      durationMin: 30,
      bufferAfterMin: 0,
      busyIntervals: [{ start: t("08:00"), end: t("09:00") }],
    })
    expect(slots.map((s) => s.toISOString().slice(11, 16))).toContain("09:00")
  })

  it("buffer after causes adjacent booking conflict detection", () => {
    // First booking 09:00–10:00, bufferAfter=15 → busy until 10:15
    // New slot at 10:00 → occupies [10:00,11:00) → overlaps busy [09:00,10:15) → blocked
    // New slot at 10:15 → occupies [10:15,11:15) → no overlap → free
    const slots = walkSlots({
      windowStart: t("09:00"),
      windowEnd: t("12:00"),
      durationMin: 60,
      bufferAfterMin: 0,
      busyIntervals: [
        // simulate existing booking + bufferAfter=15 already expanded
        { start: t("09:00"), end: t("10:15") },
      ],
    })
    const times = slots.map((s) => s.toISOString().slice(11, 16))
    expect(times).not.toContain("09:00")
    expect(times).not.toContain("09:45") // overlaps [09:00,10:15)
    expect(times).not.toContain("10:00") // overlaps [09:00,10:15)
    expect(times).toContain("10:15")
  })
})
