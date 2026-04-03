import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBusinessAuth(request)
    if (isGuardError(auth)) return auth
    const { businessId } = auth

    const breaks = await prisma.availabilityBreak.findMany({
      where: { businessId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    })

    return NextResponse.json({ breaks })
  } catch (error) {
    console.error("GET /api/availability/breaks error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireBusinessAuth(request)
    if (isGuardError(auth)) return auth
    const { businessId } = auth

    const body = await request.json()
    const { dayOfWeek, startTime, endTime, label } = body

    if (typeof dayOfWeek !== "number" || !startTime || !endTime) {
      return NextResponse.json({ error: "dayOfWeek, startTime, endTime are required" }, { status: 400 })
    }

    const br = await prisma.availabilityBreak.create({
      data: {
        businessId,
        dayOfWeek,
        startTime,
        endTime,
        label: label ?? null,
      },
    })

    return NextResponse.json({ break: br }, { status: 201 })
  } catch (error) {
    console.error("POST /api/availability/breaks error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
