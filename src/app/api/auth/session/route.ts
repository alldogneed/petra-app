export const dynamic = 'force-dynamic';
/**
 * GET /api/auth/session
 * Returns lightweight session info (used by middleware and client).
 * Never returns password hash or 2FA secret.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  const session = await resolveSession(request);

  if (!session || !session.user.isActive) {
    return NextResponse.json({ error: "No active session" }, { status: 401 });
  }

  return NextResponse.json({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    isAdmin: session.user.platformRole === "super_admin" || session.user.platformRole === "admin",
    twoFaEnabled: session.user.twoFaEnabled,
    twoFaVerified: session.twoFaVerified,
    memberships: session.memberships.map((m) => ({
      businessId: m.businessId,
      role: m.role,
    })),
  });
}
