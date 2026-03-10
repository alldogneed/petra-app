export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// PATCH /api/training-programs/[id]/sessions/[sessionId] — edit a session
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    // Verify program belongs to this business
    const program = await prisma.trainingProgram.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!program) {
      return NextResponse.json({ error: "Training program not found" }, { status: 404 });
    }

    const session = await prisma.trainingProgramSession.findFirst({
      where: { id: params.sessionId, trainingProgramId: params.id },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = await req.json();
    const { sessionDate, durationMinutes, summary, rating,
            practiceItems, nextSessionGoals, homeworkForCustomer, trainerName } = body;

    const data: Record<string, unknown> = {};
    if (sessionDate !== undefined) data.sessionDate = new Date(sessionDate);
    if (durationMinutes !== undefined) data.durationMinutes = parseInt(durationMinutes) || 60;
    if (summary !== undefined) data.summary = summary || null;
    if (rating !== undefined) data.rating = rating != null ? parseInt(rating) : null;
    if (practiceItems !== undefined) data.practiceItems = practiceItems || null;
    if (nextSessionGoals !== undefined) data.nextSessionGoals = nextSessionGoals || null;
    if (homeworkForCustomer !== undefined) data.homeworkForCustomer = homeworkForCustomer || null;
    if (trainerName !== undefined) data.trainerName = trainerName || null;

    const updated = await prisma.trainingProgramSession.update({
      where: { id: params.sessionId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/training-programs/[id]/sessions/[sessionId] error:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

// DELETE /api/training-programs/[id]/sessions/[sessionId] — delete a session
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    // Verify program belongs to this business
    const program = await prisma.trainingProgram.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!program) {
      return NextResponse.json({ error: "Training program not found" }, { status: 404 });
    }

    const session = await prisma.trainingProgramSession.findFirst({
      where: { id: params.sessionId, trainingProgramId: params.id },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // If service dog, revert accumulated training hours
    if (session.status === "COMPLETED" && program.trainingType === "SERVICE_DOG" && session.durationMinutes) {
      const sdProfile = await prisma.serviceDogProfile.findFirst({
        where: { petId: program.dogId, businessId: authResult.businessId },
      });
      if (sdProfile) {
        await prisma.serviceDogProfile.update({
          where: { id: sdProfile.id },
          data: { trainingTotalHours: { decrement: session.durationMinutes / 60 } },
        });
      }
    }

    await prisma.trainingProgramSession.delete({
      where: { id: params.sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/training-programs/[id]/sessions/[sessionId] error:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
