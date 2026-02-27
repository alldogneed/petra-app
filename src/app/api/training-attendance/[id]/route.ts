export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { attendanceStatus, notes } = body;

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
