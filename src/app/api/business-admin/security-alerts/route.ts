export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { businessHasSecurityAlertsTier } from "@/lib/security-alerts";
import {
  getSecurityAlertPrefs,
  listRecentSensitiveActivity,
  updateSecurityAlertPrefs,
  ServiceError,
} from "@/services/business-admin-security";

/** GET — { prefs, tierAllowed, recent } (owner only). */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const user = await getCurrentUser();
    if (!user || user.businessRole !== "owner" || !user.businessId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [prefs, recent, tierAllowed] = await Promise.all([
      getSecurityAlertPrefs(user.businessId, prisma),
      listRecentSensitiveActivity(user.businessId, prisma),
      businessHasSecurityAlertsTier(user.businessId),
    ]);
    return NextResponse.json({ prefs, tierAllowed, recent });
  } catch (error) {
    if (error instanceof ServiceError && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }
    console.error("business-admin/security-alerts GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** PUT — body = prefs (normalized; unknown keys dropped). Returns normalized prefs. */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const user = await getCurrentUser();
    if (!user || user.businessRole !== "owner" || !user.businessId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const prefs = await updateSecurityAlertPrefs(user.businessId, prisma, body);
    await logActivity(user.id, user.name, "UPDATE_SECURITY_ALERTS", {
      businessId: user.businessId,
      entityType: "SETTINGS",
    });
    return NextResponse.json(prefs);
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "VALIDATION") return NextResponse.json({ error: "הגדרות לא תקינות" }, { status: 400 });
      if (error.code === "NOT_FOUND") return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }
    console.error("business-admin/security-alerts PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
