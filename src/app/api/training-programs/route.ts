export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getMaxTrainingPrograms, normalizeTier } from "@/lib/feature-flags";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const trainingType = searchParams.get("trainingType");

    const statusFilter = status
      ? status.includes(",")
        ? { status: { in: status.split(",") } }
        : { status }
      : {};

    const programs = await prisma.trainingProgram.findMany({
      where: {
        businessId: authResult.businessId,
        ...statusFilter,
        ...(trainingType
          ? { trainingType }
          : { trainingType: { not: "SERVICE_DOG" } }),
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

    // Enforce training program limit for free tier
    const business = await prisma.business.findUnique({ where: { id: authResult.businessId }, select: { tier: true } });
    const maxPrograms = getMaxTrainingPrograms(normalizeTier(business?.tier));
    if (maxPrograms !== null) {
      const currentCount = await prisma.trainingProgram.count({
        where: { businessId: authResult.businessId },
      });
      if (currentCount >= maxPrograms) {
        return NextResponse.json(
          { error: `הגעת לתקרת ${maxPrograms} תוכניות האילוף במסלול החינמי. שדרג לבייסיק כדי להוסיף ללא הגבלה.`, code: "LIMIT_REACHED" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();

    // ── IDOR Prevention: validate dogId and customerId belong to this business ──
    if (body.dogId) {
      const dogCheck = await prisma.pet.findFirst({
        where: { id: body.dogId, OR: [{ customer: { businessId: authResult.businessId } }, { businessId: authResult.businessId }] },
        select: { id: true },
      });
      if (!dogCheck) {
        return NextResponse.json({ error: "כלב לא נמצא" }, { status: 404 });
      }
    }
    if (body.customerId) {
      const customerCheck = await prisma.customer.findFirst({
        where: { id: body.customerId, businessId: authResult.businessId },
        select: { id: true },
      });
      if (!customerCheck) {
        return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
      }
    }

    // If packageId provided, auto-fill sessions and price from package
    let totalSessions = body.totalSessions ?? null;
    let price = body.price ?? null;
    if (body.packageId) {
      const pkg = await prisma.trainingPackage.findFirst({
        where: { id: body.packageId, businessId: authResult.businessId },
      });
      if (pkg) {
        if (totalSessions == null) totalSessions = pkg.sessions;
        if (price == null) price = pkg.price;
      }
    }

    const program = await prisma.trainingProgram.create({
      data: {
        businessId: authResult.businessId,
        dogId: body.dogId,
        customerId: body.customerId || null,
        packageId: body.packageId || null,
        name: body.name,
        programType: body.programType || "BASIC_OBEDIENCE",
        trainingType: body.trainingType || "HOME",
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        totalSessions,
        price,
        notes: body.notes || null,
        workPlan: body.workPlan || null,
        behaviorBaseline: body.behaviorBaseline || null,
        customerExpectations: body.customerExpectations || null,
        boardingStayId: body.boardingStayId || null,
        isPackage: !!(body.isPackage || body.packageId),
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
