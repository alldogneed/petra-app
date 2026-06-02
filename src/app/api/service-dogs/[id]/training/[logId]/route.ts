export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { computeADIProgress } from "@/lib/service-dog-engine";

async function recalcTotalHours(serviceDogId: string, businessId: string): Promise<number> {
  const logs = await prisma.serviceDogTrainingLog.findMany({
    where: { serviceDogId, businessId, status: "COMPLETED" },
    select: { durationMinutes: true },
  });
  return logs.reduce((sum, l) => sum + l.durationMinutes / 60, 0);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; logId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!dog) return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });

    const log = await prisma.serviceDogTrainingLog.findFirst({
      where: { id: params.logId, serviceDogId: params.id, businessId: authResult.businessId },
    });
    if (!log) return NextResponse.json({ error: "מפגש לא נמצא" }, { status: 404 });

    const body = await request.json();
    const { sessionDate, durationMinutes, trainerName, location, skillCategories, notes, rating } = body;

    if (durationMinutes !== undefined) {
      const dur = Number(durationMinutes);
      if (!isFinite(dur) || dur < 1 || dur > 1440)
        return NextResponse.json({ error: "משך אימון לא חוקי (1–1440 דקות)" }, { status: 400 });
    }

    await prisma.serviceDogTrainingLog.update({
      where: { id: params.logId },
      data: {
        ...(sessionDate !== undefined && { sessionDate: new Date(sessionDate) }),
        ...(durationMinutes !== undefined && { durationMinutes: Number(durationMinutes) }),
        ...(trainerName !== undefined && { trainerName: trainerName || null }),
        ...(location !== undefined && { location: location || null }),
        ...(skillCategories !== undefined && { skillCategories: JSON.stringify(skillCategories) }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(rating !== undefined && { rating: rating > 0 ? rating : null }),
      },
    });

    // Recalculate total hours and update cumulative on all logs
    const newTotalHours = await recalcTotalHours(params.id, authResult.businessId);
    const progress = computeADIProgress(
      dog.trainingStartDate, newTotalHours, dog.trainingTargetHours, dog.trainingTargetMonths
    );
    await prisma.serviceDogProfile.update({
      where: { id: params.id, businessId: authResult.businessId },
      data: { trainingTotalHours: newTotalHours },
    });

    return NextResponse.json({ success: true, totalHours: newTotalHours, progress });
  } catch (error) {
    console.error("PATCH training log error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון מפגש" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; logId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!dog) return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });

    const log = await prisma.serviceDogTrainingLog.findFirst({
      where: { id: params.logId, serviceDogId: params.id, businessId: authResult.businessId },
    });
    if (!log) return NextResponse.json({ error: "מפגש לא נמצא" }, { status: 404 });

    await prisma.serviceDogTrainingLog.delete({ where: { id: params.logId } });

    const newTotalHours = await recalcTotalHours(params.id, authResult.businessId);
    const progress = computeADIProgress(
      dog.trainingStartDate, newTotalHours, dog.trainingTargetHours, dog.trainingTargetMonths
    );
    await prisma.serviceDogProfile.update({
      where: { id: params.id, businessId: authResult.businessId },
      data: { trainingTotalHours: newTotalHours },
    });

    return NextResponse.json({ success: true, totalHours: newTotalHours, progress });
  } catch (error) {
    console.error("DELETE training log error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת מפגש" }, { status: 500 });
  }
}
