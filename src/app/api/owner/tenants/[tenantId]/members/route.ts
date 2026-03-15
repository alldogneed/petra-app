export const dynamic = 'force-dynamic';
/**
 * GET  /api/owner/tenants/[tenantId]/members  — list members (platform admin)
 * POST /api/owner/tenants/[tenantId]/members  — add member (platform admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { PLATFORM_PERMS } from "@/lib/permissions";
import bcrypt from "bcryptjs";
import { z } from "zod";

export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.TENANTS_READ);
  if (isGuardError(guard)) return guard;

  const members = await prisma.businessUser.findMany({
    where: { businessId: params.tenantId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          platformRole: true,
          isActive: true,
          createdAt: true,
          sessions: {
            select: { lastSeenAt: true },
            orderBy: { lastSeenAt: "desc" as const },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
}

const AddMemberSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["owner", "manager", "user"]).default("user"),
  temporaryPassword: z.string().min(8).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.TENANTS_WRITE);
  if (isGuardError(guard)) return guard;

  let body: z.infer<typeof AddMemberSchema>;
  try {
    body = AddMemberSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const business = await prisma.business.findUnique({ where: { id: params.tenantId } });
  if (!business) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  // Check if user already exists
  let user = await prisma.platformUser.findUnique({ where: { email: body.email } });

  if (!user) {
    // Create new user
    const passwordHash = await bcrypt.hash(
      body.temporaryPassword ?? Math.random().toString(36).slice(-10) + "A1!",
      12
    );
    user = await prisma.platformUser.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        role: "USER",
        platformRole: null,
      },
    });
  }

  // Check not already a member
  const existing = await prisma.businessUser.findFirst({
    where: { businessId: params.tenantId, userId: user.id },
  });
  if (existing) {
    return NextResponse.json({ error: "משתמש כבר חבר בעסק זה" }, { status: 409 });
  }

  const membership = await prisma.businessUser.create({
    data: {
      businessId: params.tenantId,
      userId: user.id,
      role: body.role,
      isActive: true,
    },
    include: {
      user: { select: { id: true, email: true, name: true, isActive: true, createdAt: true } },
    },
  });

  return NextResponse.json(membership, { status: 201 });
}
