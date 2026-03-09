export const dynamic = "force-dynamic";
/**
 * GET /api/admin/migration/businesses?search=...
 * Returns all businesses matching the search term (case-insensitive).
 * Used by the admin migration page business selector.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { resolveSession } from "@/lib/auth-guards";
import { PLATFORM_ROLES } from "@/lib/permissions";

async function requireMasterAccess(req: NextRequest) {
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!session.user.isActive) return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
  const isLegacyMaster = (session.user as { role?: string }).role === "MASTER";
  const isSuperAdmin = session.user.platformRole === PLATFORM_ROLES.SUPER_ADMIN;
  if (!isLegacyMaster && !isSuperAdmin) return NextResponse.json({ error: "Master admin access required" }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest) {
  const deny = await requireMasterAccess(req);
  if (deny) return deny;

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
