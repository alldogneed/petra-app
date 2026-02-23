import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// PATCH /api/boarding/rooms/[id] – update room name / capacity / type
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, capacity, type } = body;

    const room = await prisma.room.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(capacity !== undefined && { capacity: Number(capacity) }),
        ...(type !== undefined && { type }),
      },
      include: {
        _count: {
          select: {
            boardingStays: {
              where: { status: { in: ["reserved", "checked_in"] } },
            },
          },
        },
      },
    });

    return NextResponse.json(room);
  } catch (error) {
    console.error("PATCH room error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון החדר" }, { status: 500 });
  }
}

// DELETE /api/boarding/rooms/[id] – delete room if no active stays
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const activeStays = await prisma.boardingStay.count({
      where: {
        roomId: params.id,
        status: { in: ["reserved", "checked_in"] },
      },
    });

    if (activeStays > 0) {
      return NextResponse.json(
        { error: "לא ניתן למחוק חדר עם שהיות פעילות" },
        { status: 409 }
      );
    }

    await prisma.room.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE room error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת החדר" }, { status: 500 });
  }
}
