export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { invalidateUserSessionCache } from "@/lib/session";
import { revokeBusinessSession, ServiceError } from "@/services/business-admin-security";

/** DELETE — revoke one session of a business member (owner only). */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const user = await getCurrentUser();
    if (!user || user.businessRole !== "owner" || !user.businessId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await revokeBusinessSession(user.businessId, prisma, {
      sessionId: params.id,
      actorId: user.id,
      currentSessionId: authResult.session.sessionId,
    });
    // Drop this instance's 30s session cache for the user (other instances expire within 30s).
    invalidateUserSessionCache(result.userId);

    await logActivity(user.id, user.name, "REVOKE_SESSION", {
      businessId: user.businessId,
      entityType: "SESSION",
      entityId: result.sessionId,
      entityLabel: `${result.userName} · ${result.device}`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "NOT_FOUND") return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
      if (error.code === "VALIDATION") return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("business-admin/sessions/[id] DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
