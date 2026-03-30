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
  const action = searchParams.get("action"); // optional filter

  const where = action ? { action } : {};

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
      },
    });

    return NextResponse.json(feed);
  } catch (error) {
    console.error("Admin feed error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת פיד" }, { status: 500 });
  }
}
