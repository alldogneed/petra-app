export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getMaxTrainingGroups, normalizeTier } from "@/lib/feature-flags";
import { GROUP_TYPE_LABELS } from "@/lib/training-groups";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";
    const groups = await prisma.trainingGroup.findMany({
      where: { businessId: authResult.businessId, ...(activeOnly && { isActive: true }) },
      include: {
        participants: {
          include: {
            dog: true,
            customer: true,
          },
        },
        sessions: {
          orderBy: { sessionDatetime: "desc" },
          take: 5,
          include: {
            attendance: true,
          },
        },
        _count: {
          select: {
            participants: true,
            sessions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(groups);
  } catch (error) {
    console.error("GET training groups error:", error);
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

    const business = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { tier: true },
    });
    const maxGroups = getMaxTrainingGroups(normalizeTier(business?.tier));
    if (maxGroups !== null) {
      const count = await prisma.trainingGroup.count({ where: { businessId: authResult.businessId } });
      if (count >= maxGroups) {
        return NextResponse.json(
          { error: `הגעת לתקרת ${maxGroups} קבוצות האילוף במסלול החינמי. שדרג למסלול Basic כדי ליצור קבוצות ללא הגבלה.`, code: "LIMIT_REACHED" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();

    // Validate required + enum/numeric fields
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "שם הקבוצה הוא שדה חובה" }, { status: 400 });
    }
    const groupType = body.groupType || "CUSTOM";
    if (!GROUP_TYPE_LABELS[groupType]) {
      return NextResponse.json({ error: "סוג קבוצה לא תקין" }, { status: 400 });
    }
    if (body.maxParticipants != null && (!Number.isInteger(body.maxParticipants) || body.maxParticipants < 1)) {
      return NextResponse.json({ error: "מספר משתתפים מקסימלי לא תקין" }, { status: 400 });
    }
    if (body.defaultDayOfWeek != null && (!Number.isInteger(body.defaultDayOfWeek) || body.defaultDayOfWeek < 0 || body.defaultDayOfWeek > 6)) {
      return NextResponse.json({ error: "יום בשבוע לא תקין" }, { status: 400 });
    }

    const group = await prisma.trainingGroup.create({
      data: {
        businessId: authResult.businessId,
        name: body.name.trim(),
        groupType,
        location: body.location || null,
        defaultDayOfWeek: body.defaultDayOfWeek ?? null,
        defaultTime: body.defaultTime || null,
        maxParticipants: body.maxParticipants ?? null,
        notes: body.notes || null,
        ...(body.reminderEnabled !== undefined && { reminderEnabled: !!body.reminderEnabled }),
        ...(body.reminderLeadHours != null && { reminderLeadHours: body.reminderLeadHours }),
        ...(body.reminderSameDay !== undefined && { reminderSameDay: !!body.reminderSameDay }),
      },
      include: {
        participants: true,
        sessions: true,
        _count: {
          select: { participants: true, sessions: true },
        },
      },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error("POST training group error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת קבוצה" }, { status: 500 });
  }
}
