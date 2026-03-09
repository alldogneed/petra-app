export const dynamic = 'force-dynamic';
/**
 * GET   /api/owner/tenants/[tenantId]  — tenant details
 * PATCH /api/owner/tenants/[tenantId]  — update tenant (suspend/activate/close)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { PLATFORM_PERMS } from "@/lib/permissions";
import { logAudit, getRequestContext, AUDIT_ACTIONS } from "@/lib/audit";
import { z } from "zod";

export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.TENANTS_READ);
  if (isGuardError(guard)) return guard;

  const tenant = await prisma.business.findUnique({
    where: { id: params.tenantId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, email: true, name: true, platformRole: true, isActive: true, createdAt: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          customers: true,
          appointments: true,
        },
      },
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Usage stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [monthlyAppointments, monthlyRevenue, lastSession] = await Promise.all([
    prisma.appointment.count({
      where: { businessId: params.tenantId, date: { gte: startOfMonth.toISOString().slice(0, 10) } },
    }),
    prisma.payment.aggregate({
      where: { businessId: params.tenantId, createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.adminSession.findFirst({
      where: {
        user: { businessMemberships: { some: { businessId: params.tenantId, isActive: true } } },
      },
      orderBy: { lastSeenAt: "desc" },
      select: { lastSeenAt: true },
    }),
  ]);

  return NextResponse.json({
    ...tenant,
    stats: {
      customerCount: tenant._count.customers,
      monthlyAppointments,
      monthlyRevenue: monthlyRevenue._sum.amount ?? 0,
      lastSeenAt: lastSession?.lastSeenAt ?? null,
    },
  });
}

const PatchTenantSchema = z.object({
  status: z.enum(["active", "suspended", "closed"]).optional(),
  name: z.string().min(1).max(100).optional(),
  tier: z.enum(["free", "basic", "pro", "groomer", "groomer_plus", "service_dog"]).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  trialEndsAt: z.string().datetime().optional().nullable(),
}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.TENANTS_WRITE);
  if (isGuardError(guard)) return guard;
  const { session } = guard;

  const { ip, userAgent } = getRequestContext(request);

  let body: z.infer<typeof PatchTenantSchema>;
  try {
    body = PatchTenantSchema.parse(await request.json());
  } catch (_e: unknown) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const existing = await prisma.business.findUnique({ where: { id: params.tenantId } });
  if (!existing) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // No future-date restriction — admins can explicitly set past dates to expire a trial immediately

  const { trialEndsAt: trialEndsAtStr, ...restBody } = body;
  const updated = await prisma.business.update({
    where: { id: params.tenantId },
    data: {
      ...restBody,
      ...(trialEndsAtStr !== undefined
        ? { trialEndsAt: trialEndsAtStr ? new Date(trialEndsAtStr) : null }
        : {}),
    },
  });

  // Determine action for audit log
  let action = "TENANT_UPDATED";
  if (body.status === "suspended" && existing.status !== "suspended") {
    action = AUDIT_ACTIONS.TENANT_SUSPENDED;
  } else if (body.status === "active" && existing.status !== "active") {
    action = AUDIT_ACTIONS.TENANT_ACTIVATED;
  } else if (body.status === "closed") {
    action = AUDIT_ACTIONS.TENANT_CLOSED;
  }

  await logAudit({
    actorUserId: session.user.id,
    actorPlatformRole: session.user.platformRole,
    action,
    targetType: "business",
    targetId: params.tenantId,
    ip,
    userAgent,
    metadata: { changes: body, previous: { status: existing.status } },
  });

  return NextResponse.json(updated);
}
