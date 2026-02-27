export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

// POST /api/training-programs/[id]/sessions – add a training session
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { sessionDate, durationMinutes, sessionNumber, summary, rating, status } = body;

    if (!sessionDate) {
      return NextResponse.json({ error: "sessionDate is required" }, { status: 400 });
    }

    const session = await prisma.trainingProgramSession.create({
      data: {
        trainingProgramId: params.id,
        sessionDate: new Date(sessionDate),
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : 60,
        sessionNumber: sessionNumber ? parseInt(sessionNumber) : null,
        summary: summary || null,
        rating: rating ? parseInt(rating) : null,
        status: status || "SCHEDULED",
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("POST /api/training-programs/[id]/sessions error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
