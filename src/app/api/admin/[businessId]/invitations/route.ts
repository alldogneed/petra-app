export const dynamic = 'force-dynamic';
/**
 * GET /api/admin/[businessId]/invitations — open (not accepted / not revoked) team invitations.
 * Requires: tenant.users.read. Never returns token hashes.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { TENANT_PERMS } from "@/lib/permissions";
import { serializeInvitation } from "@/lib/team-invitations";

export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  const guard = await requireTenantPermission(request, params.businessId, TENANT_PERMS.USERS_READ);
  if (isGuardError(guard)) return guard;

  const invitations = await prisma.teamInvitation.findMany({
    where: { businessId: params.businessId, acceptedAt: null, revokedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(invitations.map(serializeInvitation));
}
