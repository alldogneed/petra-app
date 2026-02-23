import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const program = await prisma.trainingProgram.findUnique({
      where: { id: params.id },
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
    const body = await request.json();

    const program = await prisma.trainingProgram.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.programType !== undefined && { programType: body.programType }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
        ...(body.totalSessions !== undefined && { totalSessions: body.totalSessions }),
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
