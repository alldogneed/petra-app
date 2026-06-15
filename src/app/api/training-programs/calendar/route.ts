export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { listProgramSessionsForCalendar } from "@/services/training";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const sessions = await listProgramSessionsForCalendar(authResult.businessId, prisma, { from, to });
    return NextResponse.json(sessions);
  } catch (error) {
    console.error("GET training-programs/calendar error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת מפגשי אילוף" }, { status: 500 });
  }
}
