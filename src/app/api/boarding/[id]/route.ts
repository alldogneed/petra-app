import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/boarding/[id] – get a single boarding stay
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const stay = await prisma.boardingStay.findFirst({
      where: { id: params.id, businessId: DEMO_BUSINESS_ID },
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
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Verify stay belongs to this business
    const existing = await prisma.boardingStay.findFirst({
      where: { id: params.id, businessId: DEMO_BUSINESS_ID },
    });
    if (!existing) {
      return NextResponse.json({ error: "שהייה לא נמצאה" }, { status: 404 });
    }

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
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.boardingStay.findFirst({
      where: { id: params.id, businessId: DEMO_BUSINESS_ID },
    });
    if (!existing) {
      return NextResponse.json({ error: "שהייה לא נמצאה" }, { status: 404 });
    }

    await prisma.boardingStay.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE boarding stay error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת שהייה" }, { status: 500 });
  }
}
