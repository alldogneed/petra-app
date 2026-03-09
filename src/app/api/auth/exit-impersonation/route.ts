export const dynamic = 'force-dynamic';
/**
 * POST /api/auth/exit-impersonation
 * Clears impersonation fields from the current session.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
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

export async function POST(request: NextRequest) {
  const session = await resolveSession(request);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Only super_admin can exit impersonation (it's their session feature)
  if (session.user.platformRole !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!session.impersonatedBusinessId) {
    return NextResponse.json({ error: "Not currently impersonating" }, { status: 400 });
  }

  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: "No session token" }, { status: 401 });
  }

  const impersonatedBusinessId = session.impersonatedBusinessId;

  const tokenHashed = hashToken(token);
  await prisma.adminSession.updateMany({
    where: { token: tokenHashed },
    data: {
      impersonatedBusinessId: null,
      impersonatedByAdminId: null,
    } as Record<string, unknown>,
  });

  if (impersonatedBusinessId) {
    const { ip, userAgent } = getRequestContext(request);
    await logAudit({
      actorUserId: session.user.id,
      actorPlatformRole: session.user.platformRole,
      action: "IMPERSONATION_ENDED",
      targetType: "business",
      targetId: impersonatedBusinessId,
      ip,
      userAgent,
    });
  }

  return NextResponse.json({ ok: true });
}
