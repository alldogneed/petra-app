export const dynamic = "force-dynamic";
/**
 * GET /api/admin/migration/businesses?search=...
 * Returns all businesses matching the search term (case-insensitive).
 * Used by the admin migration page business selector.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { PLATFORM_PERMS } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const authResult = await requirePlatformPermission(req, PLATFORM_PERMS.SETTINGS_WRITE);
  if (isGuardError(authResult)) return authResult;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search } },
        ],
      }
    : {};

  const businesses = await prisma.business.findMany({
    where,
    orderBy: { name: "asc" },
    take: 100,
    select: { id: true, name: true, tier: true, status: true, email: true },
  });

  return NextResponse.json({ businesses });
}
