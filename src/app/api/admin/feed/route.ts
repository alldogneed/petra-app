export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { PLATFORM_PERMS } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.AUDIT_READ);
  if (isGuardError(guard)) return guard;

  const { searchParams } = new URL(request.url);
  const parsedLimit = parseInt(searchParams.get("limit") || "50", 10);
  const limit = Math.min(Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50, 100);
  // optional filter — one action or a comma-separated group ("CREATE_LEAD,UPDATE_LEAD")
  const actions = (searchParams.get("action") ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter((a) => /^[A-Z_]{1,60}$/.test(a))
    .slice(0, 40);

  const where = actions.length ? { action: { in: actions } } : {};

  try {
    const feed = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        userName: true,
        action: true,
        createdAt: true,
        businessId: true,
      },
    });

    const bizIds = Array.from(new Set(feed.map((f) => f.businessId).filter((id): id is string => !!id)));
    const businesses = bizIds.length
      ? await prisma.business.findMany({ where: { id: { in: bizIds } }, select: { id: true, name: true } })
      : [];
    const bizName = new Map(businesses.map((b) => [b.id, b.name]));

    return NextResponse.json(
      feed.map((f) => ({ ...f, businessName: f.businessId ? bizName.get(f.businessId) ?? null : null }))
    );
  } catch (error) {
    console.error("Admin feed error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת פיד" }, { status: 500 });
  }
}
