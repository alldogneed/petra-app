export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { scheduleTrainingSessionReminder } from "@/lib/reminder-service";

// POST /api/training-programs/[id]/sessions – add a training session
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { sessionDate, durationMinutes, sessionNumber, summary, rating, status,
            practiceItems, nextSessionGoals, homeworkForCustomer, trainerName } = body;

    if (!sessionDate) {
      return NextResponse.json({ error: "sessionDate is required" }, { status: 400 });
    }

    // Verify program belongs to this business
    const program = await prisma.trainingProgram.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        dog: { select: { name: true } },
      },
    });
    if (!program) {
      return NextResponse.json({ error: "Training program not found" }, { status: 404 });
    }

    const sessionStatus = status || "COMPLETED";
    const mins = durationMinutes ? parseInt(durationMinutes) : 60;

    // Validate numeric fields
    if (!Number.isFinite(mins) || mins < 1 || mins > 1440) {
      return NextResponse.json({ error: "משך מפגש לא תקין (1-1440 דקות)" }, { status: 400 });
    }
    if (sessionNumber) {
      const sn = parseInt(sessionNumber);
      if (!Number.isFinite(sn) || sn < 1) {
        return NextResponse.json({ error: "מספר מפגש לא תקין" }, { status: 400 });
      }
    }
    if (rating) {
      const r = parseInt(rating);
      if (!Number.isFinite(r) || r < 1 || r > 5) {
        return NextResponse.json({ error: "דירוג לא תקין (1-5)" }, { status: 400 });
      }
    }
    // Validate date
    const parsedDate = new Date(sessionDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "תאריך לא תקין" }, { status: 400 });
    }
    // Validate string lengths
    if (summary && typeof summary === "string" && summary.length > 5000) {
      return NextResponse.json({ error: "סיכום ארוך מדי (מקסימום 5000 תווים)" }, { status: 400 });
    }

    const session = await prisma.trainingProgramSession.create({
      data: {
        trainingProgramId: params.id,
        sessionDate: parsedDate,
        durationMinutes: mins,
        sessionNumber: sessionNumber ? parseInt(sessionNumber) : null,
        summary: summary || null,
        rating: rating ? parseInt(rating) : null,
        status: sessionStatus,
        practiceItems: practiceItems || null,
        nextSessionGoals: nextSessionGoals || null,
        homeworkForCustomer: homeworkForCustomer || null,
        trainerName: trainerName || null,
      },
    });

    // Schedule WhatsApp reminder if session is in the future and customer exists.
    // Must be awaited — Vercel kills unawaited promises before they complete,
    // which silently drops the reminder.
    if (program.customer) {
      try {
        await scheduleTrainingSessionReminder({
          sessionId: session.id,
          sessionDate: session.sessionDate,
          businessId: authResult.businessId,
          customerId: program.customer.id,
          customerName: program.customer.name,
          customerPhone: program.customer.phone,
          dogName: program.dog.name,
          programName: program.name,
        });
      } catch (err) {
        console.error("scheduleTrainingSessionReminder failed (non-critical):", err);
      }
    }

    // Auto-accumulate training hours for service dogs
    if (sessionStatus === "COMPLETED" && program.trainingType === "SERVICE_DOG") {
      const sdProfile = await prisma.serviceDogProfile.findFirst({
        where: { petId: program.dogId, businessId: authResult.businessId },
      });
      if (sdProfile) {
        await prisma.serviceDogProfile.update({
          where: { id: sdProfile.id },
          data: { trainingTotalHours: { increment: mins / 60 } },
        });
      }
    }

    // Auto-complete removed — trainer manually finishes programs via "סיים תהליך"

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("POST /api/training-programs/[id]/sessions error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
