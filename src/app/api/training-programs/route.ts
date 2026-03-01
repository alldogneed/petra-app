export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const programs = await prisma.trainingProgram.findMany({
      where: {
        businessId: authResult.businessId,
        ...(status && { status }),
      },
      include: {
        dog: true,
        customer: true,
        goals: {
          orderBy: { sortOrder: "asc" },
        },
        sessions: {
          orderBy: { sessionDate: "desc" },
        },
        homework: {
          orderBy: { assignedDate: "desc" },
          take: 5,
        },
        _count: {
          select: { goals: true, sessions: true, homework: true },
        },
      },
      orderBy: { createdAt: "desc" },
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

    const program = await prisma.trainingProgram.create({
      data: {
        businessId: authResult.businessId,
        dogId: body.dogId,
        customerId: body.customerId,
        name: body.name,
        programType: body.programType || "BASIC_OBEDIENCE",
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        totalSessions: body.totalSessions ?? null,
        price: body.price ?? null,
        notes: body.notes || null,
      },
      include: {
        dog: true,
        customer: true,
        goals: true,
        sessions: true,
        homework: true,
      },
    });

    return NextResponse.json(program, { status: 201 });
  } catch (error) {
    console.error("POST training program error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת תוכנית" }, { status: 500 });
  }
}
