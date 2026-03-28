export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { name, capacity, type, status, pricePerSession } = body;

    const VALID_YARD_STATUSES = ["available", "needs_cleaning"];
    if (status !== undefined && !VALID_YARD_STATUSES.includes(status)) {
      return NextResponse.json({ error: "סטטוס חצר לא תקין" }, { status: 400 });
    }

    const parsedPrice = "pricePerSession" in body && pricePerSession != null ? Number(pricePerSession) : undefined;
    if (parsedPrice !== undefined && parsedPrice !== null && (isNaN(parsedPrice) || parsedPrice < 0)) {
      return NextResponse.json({ error: "מחיר לשהייה לא תקין" }, { status: 400 });
    }

    const yard = await prisma.yard.update({
      where: { id: params.id, businessId: authResult.businessId },
      data: {
        ...(name !== undefined && { name }),
        ...(capacity !== undefined && { capacity: Number(capacity) }),
        ...(type !== undefined && { type }),
        ...(status !== undefined && { status }),
        ...("pricePerSession" in body && { pricePerSession: pricePerSession != null ? parsedPrice : null }),
      },
      include: {
        _count: {
          select: {
            boardingStays: {
              where: { status: { in: ["reserved", "checked_in"] } },
            },
          },
        },
        boardingStays: {
          where: { status: { in: ["reserved", "checked_in"] } },
          include: {
            pet: { select: { id: true, name: true, breed: true, species: true } },
            customer: { select: { id: true, name: true } },
          },
          orderBy: { checkIn: "asc" },
        },
      },
    });

    return NextResponse.json(yard);
  } catch (error) {
    console.error("PATCH yard error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון החצר" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const activeStays = await prisma.boardingStay.count({
      where: {
        yardId: params.id,
        businessId: authResult.businessId,
        status: { in: ["reserved", "checked_in"] },
      },
    });

    if (activeStays > 0) {
      return NextResponse.json(
        { error: "לא ניתן למחוק חצר עם שהיות פעילות" },
        { status: 409 }
      );
    }

    await prisma.yard.delete({
      where: { id: params.id, businessId: authResult.businessId },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE yard error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת החצר" }, { status: 500 });
  }
}
