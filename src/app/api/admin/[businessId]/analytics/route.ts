export const dynamic = 'force-dynamic';
/**
 * GET /api/admin/[businessId]/analytics
 * Basic counts for tenant admin panel.
 * Requires: tenant.analytics.read
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { TENANT_PERMS } from "@/lib/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  const guard = await requireTenantPermission(
    request,
    params.businessId,
    TENANT_PERMS.ANALYTICS_READ
  );
  if (isGuardError(guard)) return guard;

  const bId = params.businessId;
  const now = new Date();
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalCustomers,
    totalPets,
    totalAppointments,
    scheduledAppointments,
    completedLast30d,
    activeMembers,
    activeRooms,
  ] = await Promise.all([
    prisma.customer.count({ where: { businessId: bId } }),
    prisma.pet.count({ where: { customer: { businessId: bId } } }),
    prisma.appointment.count({ where: { businessId: bId } }),
    prisma.appointment.count({ where: { businessId: bId, status: "scheduled" } }),
    prisma.appointment.count({
      where: { businessId: bId, status: "completed", date: { gte: last30d } },
    }),
    prisma.businessUser.count({ where: { businessId: bId, isActive: true } }),
    prisma.room.count({ where: { businessId: bId, isActive: true } }),
  ]);

  return NextResponse.json({
    totalCustomers,
    totalPets,
    totalAppointments,
    scheduledAppointments,
    completedLast30d,
    activeMembers,
    activeRooms,
  });
}
