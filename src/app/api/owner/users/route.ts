export const dynamic = 'force-dynamic';
/**
 * GET  /api/owner/users  — list platform users
 * POST /api/owner/users  — create platform user
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { PLATFORM_PERMS, PLATFORM_ROLES } from "@/lib/permissions";
import { logAudit, getRequestContext, AUDIT_ACTIONS } from "@/lib/audit";
import { isTestEmail } from "@/lib/platform-test-accounts";
import bcrypt from "bcryptjs";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.USERS_READ);
  if (isGuardError(guard)) return guard;

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") ?? "").trim().slice(0, 100);
  const status = searchParams.get("status"); // "active" | "blocked" | null
  const roleFilter = searchParams.get("role"); // "staff" (platform roles only) | null
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status === "active") where.isActive = true;
  if (status === "blocked") where.isActive = false;
  if (roleFilter === "staff") where.platformRole = { not: null };

  try {
    const [users, total] = await Promise.all([
      prisma.platformUser.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          platformRole: true,
          isActive: true,
          twoFaEnabled: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          businessMemberships: {
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
            select: {
              role: true,
              business: { select: { id: true, name: true, tier: true } },
            },
          },
          _count: { select: { businessMemberships: true } },
        },
      }),
      prisma.platformUser.count({ where }),
    ]);

    // 30-day activity score + last activity per user
    const userIds = users.map((u) => u.id);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const [activityCounts, lastActivities] = userIds.length
      ? await Promise.all([
          prisma.activityLog.groupBy({
            by: ["userId"],
            where: { userId: { in: userIds }, createdAt: { gte: thirtyDaysAgo } },
            _count: true,
          }),
          prisma.activityLog.groupBy({
            by: ["userId"],
            where: { userId: { in: userIds } },
            _max: { createdAt: true },
          }),
        ])
      : [[], []];
    const scoreMap = new Map(activityCounts.map((a) => [a.userId, a._count]));
    const lastMap = new Map(lastActivities.map((a) => [a.userId, a._max.createdAt]));

    return NextResponse.json({
      users: users.map((u) => {
        const primary = u.businessMemberships[0] ?? null;
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          platformRole: u.platformRole,
          isActive: u.isActive,
          twoFaEnabled: u.twoFaEnabled,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          lastLoginAt: u.lastLoginAt,
          _count: u._count,
          businessId: primary?.business.id ?? null,
          businessName: primary?.business.name ?? null,
          businessTier: primary?.business.tier ?? null,
          businessRole: primary?.role ?? null,
          activityScore: scoreMap.get(u.id) ?? 0,
          lastActivityAt: lastMap.get(u.id) ?? null,
          isTest: isTestEmail(u.email),
        };
      }),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("GET /api/owner/users error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8),
  platformRole: z.enum(["super_admin", "admin", "support"]).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.USERS_WRITE);
  if (isGuardError(guard)) return guard;
  const { session } = guard;

  // Only super_admin can create other super_admins
  let body: z.infer<typeof CreateUserSchema>;
  try {
    body = CreateUserSchema.parse(await request.json());
  } catch (_e: unknown) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (
    body.platformRole === PLATFORM_ROLES.SUPER_ADMIN &&
    session.user.platformRole !== PLATFORM_ROLES.SUPER_ADMIN
  ) {
    return NextResponse.json(
      { error: "Only super_admin can grant super_admin role" },
      { status: 403 }
    );
  }

  const existing = await prisma.platformUser.findUnique({
    where: { email: body.email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const { ip, userAgent } = getRequestContext(request);

  const user = await prisma.platformUser.create({
    data: {
      email: body.email,
      name: body.name,
      passwordHash,
      platformRole: body.platformRole ?? null,
      isActive: true,
    },
    select: { id: true, email: true, name: true, platformRole: true, isActive: true, createdAt: true },
  });

  await logAudit({
    actorUserId: session.user.id,
    actorPlatformRole: session.user.platformRole,
    action: AUDIT_ACTIONS.PLATFORM_USER_CREATED,
    targetType: "user",
    targetId: user.id,
    ip,
    userAgent,
    metadata: { email: user.email, platformRole: user.platformRole },
  });

  return NextResponse.json(user, { status: 201 });
}
