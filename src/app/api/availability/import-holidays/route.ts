export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards"

// Israeli holidays 5786-5787
const HOLIDAYS: { label: string; dates: string[][] }[] = [
  // 5786 (2025-2026)
  { label: "ראש השנה תשפ״ו",    dates: [["2025-09-22", "2025-09-24"]] },
  { label: "יום כיפור תשפ״ו",   dates: [["2025-10-01", "2025-10-02"]] },
  { label: "סוכות תשפ״ו",       dates: [["2025-10-06", "2025-10-07"], ["2025-10-13", "2025-10-14"]] },
  { label: "פורים תשפ״ו",       dates: [["2026-03-03", "2026-03-04"]] },
  { label: "פסח תשפ״ו",         dates: [["2026-04-01", "2026-04-02"], ["2026-04-07", "2026-04-08"]] },
  { label: "יום העצמאות תשפ״ו", dates: [["2026-04-29", "2026-04-30"]] },
  { label: "שבועות תשפ״ו",      dates: [["2026-05-21", "2026-05-22"]] },
  // 5787 (2026-2027)
  { label: "ראש השנה תשפ״ז",    dates: [["2026-09-11", "2026-09-13"]] },
  { label: "יום כיפור תשפ״ז",   dates: [["2026-09-20", "2026-09-21"]] },
  { label: "סוכות תשפ״ז",       dates: [["2026-09-25", "2026-09-27"], ["2026-10-01", "2026-10-03"]] },
  { label: "פורים תשפ״ז",       dates: [["2027-03-23", "2027-03-24"]] },
  { label: "פסח תשפ״ז",         dates: [["2027-04-21", "2027-04-22"], ["2027-04-27", "2027-04-28"]] },
  { label: "שבועות תשפ״ז",      dates: [["2027-06-11", "2027-06-12"]] },
]

export async function POST(request: NextRequest) {
  try {
    const auth = await requireBusinessAuth(request)
    if (isGuardError(auth)) return auth
    const { businessId } = auth

    let created = 0

    for (const holiday of HOLIDAYS) {
      for (const [startDate, endDate] of holiday.dates) {
        const startAt = new Date(`${startDate}T00:00:00Z`)
        const endAt = new Date(`${endDate}T23:59:59Z`)

        // Skip if a block with the exact same businessId+startAt+endAt already exists
        const existing = await prisma.availabilityBlock.findFirst({
          where: { businessId, startAt, endAt },
        })
        if (existing) continue

        await prisma.availabilityBlock.create({
          data: {
            businessId,
            startAt,
            endAt,
            reason: holiday.label,
          },
        })
        created++
      }
    }

    return NextResponse.json({ created })
  } catch (error) {
    console.error("POST /api/availability/import-holidays error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
