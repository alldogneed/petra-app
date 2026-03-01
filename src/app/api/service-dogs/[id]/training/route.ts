export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { accumulateTrainingHours, computeADIProgress } from "@/lib/service-dog-engine";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });

    if (!dog) {
      return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
    }

    const logs = await prisma.serviceDogTrainingLog.findMany({
      where: { serviceDogId: params.id },
      orderBy: { sessionDate: "desc" },
    });

    const progress = computeADIProgress(
      dog.trainingStartDate,
      dog.trainingTotalHours,
      dog.trainingTargetHours,
      dog.trainingTargetMonths
    );

    return NextResponse.json({ logs, progress });
  } catch (error) {
    console.error("GET /api/service-dogs/[id]/training error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת אימונים" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { sessionDate, durationMinutes, trainerName, location, skillCategories, status, notes, rating } = body;

    if (!sessionDate || !durationMinutes) {
      return NextResponse.json({ error: "נדרש תאריך ומשך אימון" }, { status: 400 });
    }

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });

    if (!dog) {
      return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
    }

    const sessionStatus = status || "COMPLETED";
    const newTotalHours = accumulateTrainingHours(
      dog.trainingTotalHours,
      durationMinutes,
      sessionStatus
    );

    const log = await prisma.serviceDogTrainingLog.create({
      data: {
        serviceDogId: params.id,
        businessId: authResult.businessId,
        sessionDate: new Date(sessionDate),
        durationMinutes,
        trainerName: trainerName || null,
        location: location || null,
        skillCategories: JSON.stringify(skillCategories || []),
        status: sessionStatus,
        notes: notes || null,
        rating: rating || null,
        cumulativeHours: newTotalHours,
      },
    });

    // Update profile total hours + check readiness
    const progress = computeADIProgress(
      dog.trainingStartDate,
      newTotalHours,
      dog.trainingTargetHours,
      dog.trainingTargetMonths
    );

    const newTrainingStatus =
      progress.isReadyForCertification && dog.trainingStatus === "IN_PROGRESS"
        ? "PENDING_CERT"
        : dog.trainingStatus === "NOT_STARTED" && sessionStatus === "COMPLETED"
        ? "IN_PROGRESS"
        : dog.trainingStatus;

    await prisma.serviceDogProfile.update({
      where: { id: params.id },
      data: {
        trainingTotalHours: newTotalHours,
        trainingStatus: newTrainingStatus,
        ...(dog.trainingStatus === "NOT_STARTED" && sessionStatus === "COMPLETED"
          ? { trainingStartDate: new Date(sessionDate) }
          : {}),
      },
    });

    return NextResponse.json({ log, progress, trainingStatus: newTrainingStatus }, { status: 201 });
  } catch (error) {
    console.error("POST /api/service-dogs/[id]/training error:", error);
    return NextResponse.json({ error: "שגיאה בהוספת מפגש אימון" }, { status: 500 });
  }
}
