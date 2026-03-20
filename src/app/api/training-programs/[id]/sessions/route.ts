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

    const session = await prisma.trainingProgramSession.create({
      data: {
        trainingProgramId: params.id,
        sessionDate: new Date(sessionDate),
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

    // Schedule WhatsApp reminder if session is in the future and customer exists
    if (program.customer) {
      scheduleTrainingSessionReminder({
        sessionId: session.id,
        sessionDate: session.sessionDate,
        businessId: authResult.businessId,
        customerId: program.customer.id,
        customerName: program.customer.name,
        customerPhone: program.customer.phone,
        dogName: program.dog.name,
        programName: program.name,
      }).catch(() => { /* non-critical — ignore errors */ });
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
