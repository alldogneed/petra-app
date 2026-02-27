export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    // Get session count for numbering
    const count = await prisma.trainingGroupSession.count({
      where: { trainingGroupId: params.id },
    });

    const session = await prisma.trainingGroupSession.create({
      data: {
        trainingGroupId: params.id,
        sessionDatetime: new Date(body.sessionDatetime),
        sessionNumber: count + 1,
        status: body.status || "SCHEDULED",
        notes: body.notes || null,
      },
      include: {
        attendance: true,
      },
    });

    // Auto-create attendance records for all active participants
    const participants = await prisma.trainingGroupParticipant.findMany({
      where: { trainingGroupId: params.id, status: "ACTIVE" },
    });

    if (participants.length > 0) {
      await prisma.trainingGroupAttendance.createMany({
        data: participants.map((p) => ({
          trainingGroupSessionId: session.id,
          participantId: p.id,
          dogId: p.dogId,
          customerId: p.customerId,
          attendanceStatus: "PRESENT",
        })),
      });
    }

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("POST training session error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת מפגש" }, { status: 500 });
  }
}
