export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { updateAttendance, ServiceError } from "@/services/training";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { attendanceStatus, notes } = body;

    let record;
    try {
      record = await updateAttendance(authResult.businessId, prisma, params.id, {
        attendanceStatus,
        notes,
      });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error("PATCH training attendance error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון נוכחות" }, { status: 500 });
  }
}
