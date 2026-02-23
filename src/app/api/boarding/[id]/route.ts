import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/boarding/[id] – get a single boarding stay
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const stay = await prisma.boardingStay.findUnique({
      where: { id: params.id },
      include: {
        room: true,
        pet: true,
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    });

    if (!stay) {
      return NextResponse.json({ error: "שהייה לא נמצאה" }, { status: 404 });
    }

    return NextResponse.json(stay);
  } catch (error) {
    console.error("GET boarding stay error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת שהייה" }, { status: 500 });
  }
}

// PATCH /api/boarding/[id] – update boarding stay
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const stay = await prisma.boardingStay.update({
      where: { id: params.id },
      data: {
        ...(body.checkIn !== undefined && { checkIn: new Date(body.checkIn) }),
        ...(body.checkOut !== undefined && { checkOut: body.checkOut ? new Date(body.checkOut) : null }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.roomId !== undefined && { roomId: body.roomId }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      include: {
        room: true,
        pet: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    return NextResponse.json(stay);
  } catch (error) {
    console.error("PATCH boarding stay error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון שהייה" }, { status: 500 });
  }
}

// DELETE /api/boarding/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.boardingStay.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE boarding stay error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת שהייה" }, { status: 500 });
  }
}
