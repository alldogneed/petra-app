export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { invalidateUserSessionCache } from "@/lib/session";
import { listBusinessSessions, revokeMemberSessions, ServiceError } from "@/services/business-admin-security";

/** GET — active sessions of all business members (owner only). Never returns session tokens. */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const user = await getCurrentUser();
    if (!user || user.businessRole !== "owner" || !user.businessId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sessions = await listBusinessSessions(user.businessId, prisma, {
      currentSessionId: authResult.session.sessionId,
      actorId: user.id,
    });
    return NextResponse.json(sessions);
  } catch (error) {
    console.error("business-admin/sessions GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE ?userId=<id> — revoke all sessions of one member (except the actor's current session). */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const user = await getCurrentUser();
    if (!user || user.businessRole !== "owner" || !user.businessId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = request.nextUrl.searchParams.get("userId")?.trim() ?? "";
    if (!userId) return NextResponse.json({ error: "חסר מזהה משתמש" }, { status: 400 });

    const result = await revokeMemberSessions(user.businessId, prisma, {
      userId,
      actorId: user.id,
      currentSessionId: authResult.session.sessionId,
    });
    invalidateUserSessionCache(result.userId);

    if (result.revoked > 0) {
      await logActivity(user.id, user.name, "REVOKE_SESSION", {
        businessId: user.businessId,
        entityType: "MEMBER",
        entityId: result.userId,
        entityLabel: `${result.userName} · כל הסשנים (${result.revoked})`,
      });
    }
    return NextResponse.json({ revoked: result.revoked });
  } catch (error) {
    if (error instanceof ServiceError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "VALIDATION" ? 400 : 403;
      return NextResponse.json({ error: status === 404 ? "לא נמצא" : error.message }, { status });
    }
    console.error("business-admin/sessions DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
