export const dynamic = 'force-dynamic';
/**
 * POST /api/owner/tenants/[tenantId]/impersonate
 * Super admin impersonates a tenant — sets impersonatedBusinessId on session.
 * Only super_admin can impersonate.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { PLATFORM_PERMS, PLATFORM_ROLES } from "@/lib/permissions";
import { logAudit, getRequestContext } from "@/lib/audit";
import { createHash } from "crypto";
import { SESSION_COOKIE } from "@/lib/session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function extractToken(request: NextRequest): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const guard = await requirePlatformPermission(request, PLATFORM_PERMS.TENANTS_WRITE);
  if (isGuardError(guard)) return guard;
  const { session } = guard;

  // Only super_admin can impersonate
  if (session.user.platformRole !== PLATFORM_ROLES.SUPER_ADMIN) {
    return NextResponse.json({ error: "Only super_admin can impersonate tenants" }, { status: 403 });
  }

  // Verify business exists
  const business = await prisma.business.findUnique({
    where: { id: params.tenantId },
    select: { id: true, name: true, status: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  if (business.status === "closed") {
    return NextResponse.json({ error: "Cannot impersonate a closed business" }, { status: 400 });
  }
  if (business.status === "suspended") {
    return NextResponse.json({ error: "Cannot impersonate a suspended business" }, { status: 400 });
  }

  // Update session with impersonation fields
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: "No session token" }, { status: 401 });
  }
  const tokenHashed = hashToken(token);

  await prisma.adminSession.updateMany({
    where: { token: tokenHashed },
    data: {
      impersonatedBusinessId: params.tenantId,
      impersonatedByAdminId: session.user.id,
    } as Record<string, unknown>,
  });

  const { ip, userAgent } = getRequestContext(request);
  await logAudit({
    actorUserId: session.user.id,
    actorPlatformRole: session.user.platformRole,
    action: "IMPERSONATION_STARTED",
    targetType: "business",
    targetId: params.tenantId,
    ip,
    userAgent,
    metadata: { businessName: business.name },
  });

  return NextResponse.json({ ok: true, businessName: business.name });
}
