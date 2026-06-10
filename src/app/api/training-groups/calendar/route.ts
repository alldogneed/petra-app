export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const sessions = await prisma.trainingGroupSession.findMany({
      where: {
        trainingGroup: { businessId: authResult.businessId },
        ...(from || to
          ? {
              sessionDatetime: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
              },
            }
          : {}),
      },
      include: {
        trainingGroup: {
          select: {
            id: true,
            name: true,
            groupType: true,
            location: true,
          },
        },
        attendance: {
          select: { id: true },
        },
      },
      orderBy: { sessionDatetime: "asc" },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("GET training-groups/calendar error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת מפגשי הקבוצות" }, { status: 500 });
  }
}
