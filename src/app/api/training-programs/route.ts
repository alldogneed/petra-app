export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getMaxTrainingPrograms, normalizeTier } from "@/lib/feature-flags";
import { PROGRAM_TYPE_LABELS, TRAINING_TYPE_LABELS } from "@/lib/training-programs";
import { listTrainingPrograms, createTrainingProgram, ServiceError } from "@/services/training";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const programs = await listTrainingPrograms(authResult.businessId, prisma, {
      status: searchParams.get("status") || undefined,
      trainingType: searchParams.get("trainingType") || undefined,
    });
    return NextResponse.json(programs);
  } catch (error) {
    console.error("GET training programs error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת תוכניות" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:training-programs:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();

    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "שם תוכנית הוא שדה חובה" }, { status: 400 });
    }
    if (!body.dogId || typeof body.dogId !== "string") {
      return NextResponse.json({ error: "יש לבחור כלב" }, { status: 400 });
    }
    if (body.programType && !PROGRAM_TYPE_LABELS[body.programType]) {
      return NextResponse.json({ error: "סוג תוכנית לא תקין" }, { status: 400 });
    }
    if (body.trainingType && !TRAINING_TYPE_LABELS[body.trainingType]) {
      return NextResponse.json({ error: "סוג אילוף לא תקין" }, { status: 400 });
    }
    if (body.name.length > 200) {
      return NextResponse.json({ error: "שם תוכנית ארוך מדי (מקסימום 200 תווים)" }, { status: 400 });
    }
    for (const field of ["workPlan", "behaviorBaseline", "customerExpectations", "notes"] as const) {
      if (body[field] && typeof body[field] === "string" && body[field].length > 5000) {
        return NextResponse.json({ error: "השדה ארוך מדי (מקסימום 5000 תווים)" }, { status: 400 });
      }
    }

    let totalSessions = body.totalSessions ?? null;
    let price = body.price ?? null;
    if (totalSessions != null) {
      totalSessions = parseInt(totalSessions, 10);
      if (!Number.isFinite(totalSessions) || totalSessions < 1 || totalSessions > 1000) {
        return NextResponse.json({ error: "מספר מפגשים לא תקין" }, { status: 400 });
      }
    }
    if (price != null) {
      price = parseFloat(price);
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: "מחיר לא תקין" }, { status: 400 });
      }
    }

    const business = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { tier: true },
    });
    const maxPrograms = getMaxTrainingPrograms(normalizeTier(business?.tier));

    let program;
    try {
      program = await createTrainingProgram(authResult.businessId, prisma, {
        name: body.name,
        dogId: body.dogId,
        customerId: body.customerId || undefined,
        packageId: body.packageId || undefined,
        programType: body.programType || undefined,
        trainingType: body.trainingType || undefined,
        startDate: body.startDate || undefined,
        endDate: body.endDate || undefined,
        notes: body.notes || undefined,
        workPlan: body.workPlan || undefined,
        behaviorBaseline: body.behaviorBaseline || undefined,
        customerExpectations: body.customerExpectations || undefined,
        boardingStayId: body.boardingStayId || undefined,
        isPackage: body.isPackage || undefined,
        totalSessions,
        price,
      }, { maxPrograms });
    } catch (e) {
      if (e instanceof ServiceError) {
        const details = e.details as { code?: string } | null;
        if (details?.code === "LIMIT_REACHED") {
          return NextResponse.json({ error: e.message, code: "LIMIT_REACHED" }, { status: 403 });
        }
        return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 400 });
      }
      throw e;
    }

    return NextResponse.json(program, { status: 201 });
  } catch (error) {
    console.error("POST training program error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת תוכנית" }, { status: 500 });
  }
}
