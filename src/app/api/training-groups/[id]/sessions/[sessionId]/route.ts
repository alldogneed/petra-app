import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    // Verify session belongs to this group
    const existing = await prisma.trainingGroupSession.findFirst({
      where: { id: params.sessionId, trainingGroupId: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "מפגש לא נמצא" }, { status: 404 });
    }

    const session = await prisma.trainingGroupSession.update({
      where: { id: params.sessionId },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      include: {
        attendance: true,
      },
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("PATCH training session error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון מפגש" }, { status: 500 });
  }
}
