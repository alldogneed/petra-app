export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const program = await prisma.trainingProgram.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: {
        dog: true,
        customer: true,
        goals: {
          orderBy: { sortOrder: "asc" },
        },
        sessions: {
          orderBy: { sessionDate: "desc" },
        },
        homework: {
          orderBy: { assignedDate: "desc" },
        },
      },
    });

    if (!program) {
      return NextResponse.json({ error: "תוכנית לא נמצאה" }, { status: 404 });
    }

    return NextResponse.json(program);
  } catch (error) {
    console.error("GET training program error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת תוכנית" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Verify program belongs to this business
    const existing = await prisma.trainingProgram.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "תוכנית לא נמצאה" }, { status: 404 });
    }

    const body = await request.json();

    const program = await prisma.trainingProgram.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.programType !== undefined && { programType: body.programType }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : undefined }),
        ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
        ...(body.totalSessions !== undefined && { totalSessions: body.totalSessions }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.location !== undefined && { location: body.location }),
        ...(body.frequency !== undefined && { frequency: body.frequency }),
      },
      include: {
        dog: true,
        customer: true,
        goals: { orderBy: { sortOrder: "asc" } },
        sessions: { orderBy: { sessionDate: "desc" } },
        homework: { orderBy: { assignedDate: "desc" } },
      },
    });

    return NextResponse.json(program);
  } catch (error) {
    console.error("PATCH training program error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון תוכנית" }, { status: 500 });
  }
}
