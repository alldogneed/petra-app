/**
 * GET  /api/owner/users  — list platform users
 * POST /api/owner/users  — create platform user
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { PLATFORM_PERMS, PLATFORM_ROLES } from "@/lib/permissions";
import { logAudit, getRequestContext, AUDIT_ACTIONS } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.USERS_READ);
  if (isGuardError(guard)) return guard;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ];
  }

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
        _count: { select: { businessMemberships: true } },
      },
    }),
    prisma.platformUser.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, limit });
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
  } catch (e: unknown) {
    const zodError = e as { errors?: unknown };
    return NextResponse.json({ error: "Invalid request", details: zodError.errors }, { status: 400 });
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

  const existing = await prisma.platformUser.findUnique({ where: { email: body.email } });
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
