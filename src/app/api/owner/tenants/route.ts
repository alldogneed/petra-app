export const dynamic = 'force-dynamic';
/**
 * GET  /api/owner/tenants  — list/search tenants
 * POST /api/owner/tenants  — create tenant
 * Requires: platform.tenants.read / platform.tenants.write
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { PLATFORM_PERMS } from "@/lib/permissions";
import { logAudit, getRequestContext, AUDIT_ACTIONS } from "@/lib/audit";
import { z } from "zod";
import bcrypt from "bcryptjs";

export async function GET(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.TENANTS_READ);
  if (isGuardError(guard)) return guard;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ];
  }

  const [tenants, total] = await Promise.all([
    prisma.business.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        tier: true,
        status: true,
        createdAt: true,
        _count: { select: { members: { where: { isActive: true } } } },
      },
    }),
    prisma.business.count({ where }),
  ]);

  return NextResponse.json({ tenants, total, page, limit });
}

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  tier: z.enum(["free", "basic", "pro", "groomer"]).default("basic"),
  ownerName: z.string().min(1).max(100).optional(),
  ownerEmail: z.string().email().optional(),
  ownerPassword: z.string().min(8).optional(),
});

export async function POST(request: NextRequest) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.TENANTS_WRITE);
  if (isGuardError(guard)) return guard;
  const { session } = guard;

  const { ip, userAgent } = getRequestContext(request);

  let body: z.infer<typeof CreateTenantSchema>;
  try {
    body = CreateTenantSchema.parse(await request.json());
  } catch (_e: unknown) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const hasOwner = body.ownerName && body.ownerEmail && body.ownerPassword;

  if (hasOwner) {
    // Check for existing user before transaction
    const existing = await prisma.platformUser.findUnique({ where: { email: body.ownerEmail! } });
    if (existing) {
      return NextResponse.json({ error: "משתמש עם אימייל זה כבר קיים" }, { status: 409 });
    }
  }

  let tenant: Awaited<ReturnType<typeof prisma.business.create>>;
  let owner: { id: string; email: string; name: string } | null = null;

  if (hasOwner) {
    const passwordHash = await bcrypt.hash(body.ownerPassword!, 12);
    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: body.name,
          email: body.email ?? null,
          phone: body.phone ?? null,
          tier: body.tier,
          status: "active",
        },
      });
      const platformUser = await tx.platformUser.create({
        data: {
          name: body.ownerName!,
          email: body.ownerEmail!,
          passwordHash,
          role: "USER",
          platformRole: null,
        },
      });
      await tx.businessUser.create({
        data: {
          businessId: business.id,
          userId: platformUser.id,
          role: "owner",
        },
      });
      return { business, platformUser };
    });
    tenant = result.business;
    owner = { id: result.platformUser.id, email: result.platformUser.email, name: result.platformUser.name };
  } else {
    tenant = await prisma.business.create({
      data: {
        name: body.name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        tier: body.tier,
        status: "active",
      },
    });
  }

  await logAudit({
    actorUserId: session.user.id,
    actorPlatformRole: session.user.platformRole,
    action: AUDIT_ACTIONS.TENANT_CREATED,
    targetType: "business",
    targetId: tenant.id,
    ip,
    userAgent,
    metadata: { name: tenant.name, ownerEmail: owner?.email ?? null },
  });

  return NextResponse.json({ business: tenant, owner }, { status: 201 });
}
