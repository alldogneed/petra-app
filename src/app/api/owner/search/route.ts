export const dynamic = 'force-dynamic';
/**
 * GET /api/owner/search?q=  — global search for the platform admin panel.
 * Finds businesses (name / email / phone) and users (name / email).
 * Requires: platform.tenants.read (users are returned only with platform.users.read)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { PLATFORM_PERMS, hasPlatformPermission } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.TENANTS_READ);
  if (isGuardError(guard)) return guard;
  const { session } = guard;

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ businesses: [], users: [] });

  const canReadUsers = hasPlatformPermission(session.user.platformRole, PLATFORM_PERMS.USERS_READ);
  const digits = q.replace(/[^\d]/g, "");

  try {
    const [businesses, users] = await Promise.all([
      prisma.business.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, name: true, tier: true, status: true },
      }),
      canReadUsers
        ? prisma.platformUser.findMany({
            where: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            },
            orderBy: { createdAt: "desc" },
            take: 6,
            select: { id: true, name: true, email: true, isActive: true },
          })
        : [],
    ]);

    return NextResponse.json({ businesses, users });
  } catch (error) {
    console.error("GET /api/owner/search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
