export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/training-programs/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
// Individual training-program sessions for the calendar (businessId from session).
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const sessions = await prisma.trainingProgramSession.findMany({
      where: {
        program: { businessId: authResult.businessId },
        ...(from || to
          ? {
              sessionDate: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
              },
            }
          : {}),
      },
      select: {
        id: true,
        sessionDate: true,
        sessionNumber: true,
        durationMinutes: true,
        status: true,
        program: {
          select: {
            id: true,
            name: true,
            trainingType: true,
            location: true,
            dog: { select: { id: true, name: true } },
            customer: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { sessionDate: "asc" },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("GET training-programs/calendar error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת מפגשי אילוף" }, { status: 500 });
  }
}
