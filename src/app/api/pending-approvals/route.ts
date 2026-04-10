export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { hasTenantPermission, TENANT_PERMS } from "@/lib/permissions";
import { expireOldApprovals } from "@/lib/pending-approvals";

/** GET /api/pending-approvals — list pending approvals for this business
 *  Owner sees all; manager sees only their own requests.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { session, businessId } = authResult;

  try {
  // Expire stale approvals on every fetch (cheap cleanup)
  await expireOldApprovals(businessId);

  const membership = session.memberships.find((m) => m.businessId === businessId);
  const role = membership?.role ?? "user";

  const isOwner = hasTenantPermission(role, TENANT_PERMS.APPROVE_ACTIONS);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "PENDING";

  const approvals = await prisma.pendingApproval.findMany({
    where: {
      businessId,
      status,
      // Manager only sees their own requests
      ...(isOwner ? {} : { requestedByUserId: session.user.id }),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      description: true,
      status: true,
      rejectionReason: true,
      expiresAt: true,
      resolvedAt: true,
      createdAt: true,
      requestedBy: { select: { id: true, name: true, email: true } },
      resolvedBy:  { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ approvals });
  } catch (error) {
    console.error("Pending approvals error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת אישורים" }, { status: 500 });
  }
}
