export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { attendanceStatus, notes } = body;

    // Verify the attendance record belongs to this business via the session → group chain
    const existing = await prisma.trainingGroupAttendance.findUnique({
      where: { id: params.id },
      select: {
        session: { select: { trainingGroup: { select: { businessId: true } } } },
      },
    });

    if (
      !existing ||
      existing.session.trainingGroup.businessId !== authResult.businessId
    ) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    const record = await prisma.trainingGroupAttendance.update({
      where: { id: params.id },
      data: {
        ...(attendanceStatus !== undefined && { attendanceStatus }),
        ...(notes !== undefined && { notes }),
        markedAt: new Date(),
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error("PATCH training attendance error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון נוכחות" }, { status: 500 });
  }
}
