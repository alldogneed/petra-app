export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimitAsync } from "@/lib/rate-limit";
import { getDashboardPrefs, saveDashboardPrefs } from "@/services/dashboard-prefs";
import { ServiceError } from "@/services/types";

const MAX_BODY_BYTES = 8 * 1024;

// GET /api/dashboard/preferences — the signed-in member's dashboard layout
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;
    const result = await getDashboardPrefs(prisma, businessId, session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Dashboard prefs GET error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת הגדרות התצוגה" }, { status: 500 });
  }
}

// PUT /api/dashboard/preferences — body { prefs: { hidden, order } } or { prefs: null } (reset)
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    const rl = await rateLimitAsync("dashboard:prefs", session.user.id, { max: 60, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב בעוד דקה." }, { status: 429 });
    }

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "הבקשה גדולה מדי" }, { status: 413 });
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "JSON לא תקין" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || !("prefs" in body)) {
      return NextResponse.json({ error: "חסר שדה prefs" }, { status: 400 });
    }

    const result = await saveDashboardPrefs(
      prisma,
      businessId,
      session.user.id,
      (body as { prefs: unknown }).prefs
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ServiceError) {
      const status = error.code === "VALIDATION" ? 400 : error.code === "UNAUTHORIZED" ? 403 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("Dashboard prefs PUT error:", error);
    return NextResponse.json({ error: "שגיאה בשמירת הגדרות התצוגה" }, { status: 500 });
  }
}
