export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const programs = await prisma.trainingProgram.findMany({
      where: {
        businessId: DEMO_BUSINESS_ID,
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
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    const program = await prisma.trainingProgram.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
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
