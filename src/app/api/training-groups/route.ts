export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getMaxTrainingGroups, normalizeTier } from "@/lib/feature-flags";
import { GROUP_TYPE_LABELS } from "@/lib/training-groups";
import { listTrainingGroups, createTrainingGroup, ServiceError } from "@/services/training";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const activeOnly =
      searchParams.get("activeOnly") === "true" || searchParams.get("active") === "true";

    const groups = await listTrainingGroups(authResult.businessId, prisma, { activeOnly });
    return NextResponse.json(groups);
  } catch (error) {
    console.error("GET training-groups error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת קבוצות" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:training-groups:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "שם הקבוצה הוא שדה חובה" }, { status: 400 });
    }
    if (body.name.trim().length > 200) {
      return NextResponse.json({ error: "שם הקבוצה ארוך מדי (עד 200 תווים)" }, { status: 400 });
    }
    if (!GROUP_TYPE_LABELS[body.groupType]) {
      return NextResponse.json({ error: "סוג קבוצה לא תקין" }, { status: 400 });
    }
    if (body.maxParticipants != null) {
      const n = parseInt(body.maxParticipants);
      if (!Number.isFinite(n) || n < 1) {
        return NextResponse.json({ error: "מקסימום משתתפים לא תקין" }, { status: 400 });
      }
    }
    if (body.defaultDayOfWeek != null) {
      const n = parseInt(body.defaultDayOfWeek);
      if (!Number.isFinite(n) || n < 0 || n > 6) {
        return NextResponse.json({ error: "יום בשבוע לא תקין" }, { status: 400 });
      }
    }

    const biz = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { tier: true },
    });
    const maxGroups = getMaxTrainingGroups(normalizeTier(biz?.tier));

    let group;
    try {
      group = await createTrainingGroup(authResult.businessId, prisma, body, { maxGroups });
    } catch (e) {
      if (e instanceof ServiceError) {
        const details = e.details as { code?: string } | null;
        if (details?.code === "LIMIT_REACHED") {
          return NextResponse.json({ error: e.message, code: "LIMIT_REACHED" }, { status: 403 });
        }
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error("POST training-groups error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת קבוצה" }, { status: 500 });
  }
}
