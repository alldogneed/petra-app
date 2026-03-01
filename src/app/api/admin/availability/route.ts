export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requirePlatformPermission, resolveSession, isGuardError } from "@/lib/auth-guards"
import { PLATFORM_PERMS } from "@/lib/permissions"

const DEFAULT_RULES = [
  { dayOfWeek: 0, isOpen: false, openTime: "09:00", closeTime: "18:00" }, // Sun
  { dayOfWeek: 1, isOpen: true,  openTime: "09:00", closeTime: "18:00" }, // Mon
  { dayOfWeek: 2, isOpen: true,  openTime: "09:00", closeTime: "18:00" }, // Tue
  { dayOfWeek: 3, isOpen: true,  openTime: "09:00", closeTime: "18:00" }, // Wed
  { dayOfWeek: 4, isOpen: true,  openTime: "09:00", closeTime: "18:00" }, // Thu
  { dayOfWeek: 5, isOpen: true,  openTime: "09:00", closeTime: "14:00" }, // Fri
  { dayOfWeek: 6, isOpen: false, openTime: "09:00", closeTime: "18:00" }, // Sat
]

// GET /api/admin/availability
export async function GET(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.TENANTS_READ);
  if (isGuardError(guard)) return guard;

  const { searchParams } = new URL(request.url);
  const session = await resolveSession(request);
  const businessId =
    searchParams.get("businessId") ||
    session?.memberships.find((m) => m.isActive)?.businessId ||
    ""
  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }
  let rules = await prisma.availabilityRule.findMany({
    where: { businessId },
    orderBy: { dayOfWeek: "asc" },
  })

  // Seed defaults if none exist
  if (rules.length === 0) {
    rules = await Promise.all(
      DEFAULT_RULES.map((r) =>
        prisma.availabilityRule.create({ data: { ...r, businessId } })
      )
    )
  }

  return NextResponse.json({ rules })
}

// PUT /api/admin/availability
// Body: { rules: [{ dayOfWeek, isOpen, openTime, closeTime }], businessId? }
export async function PUT(req: NextRequest) {
  const guard = await requirePlatformPermission(req, PLATFORM_PERMS.TENANTS_WRITE);
  if (isGuardError(guard)) return guard;

  const body = await req.json();
  const { rules } = body;
  const session = await resolveSession(req);
  const businessId =
    body.businessId ||
    session?.memberships.find((m) => m.isActive)?.businessId ||
    ""
  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }

  if (!Array.isArray(rules)) {
    return NextResponse.json({ error: "rules must be an array" }, { status: 400 })
  }

  const updated = await prisma.$transaction(
    rules.map((r: { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }) =>
      prisma.availabilityRule.upsert({
        where: { businessId_dayOfWeek: { businessId, dayOfWeek: r.dayOfWeek } },
        update: { isOpen: r.isOpen, openTime: r.openTime, closeTime: r.closeTime },
        create: { businessId, dayOfWeek: r.dayOfWeek, isOpen: r.isOpen, openTime: r.openTime, closeTime: r.closeTime },
      })
    )
  )

  return NextResponse.json({ rules: updated })
}
