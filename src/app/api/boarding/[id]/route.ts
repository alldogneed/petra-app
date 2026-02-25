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

    // Build notes: append check-in/out notes if provided
    let notesUpdate: string | undefined;
    if (body.notes !== undefined) {
      notesUpdate = body.notes;
    }
    if (body.checkinNotes) {
      const prefix = `[צ׳ק-אין ${new Date().toLocaleString("he-IL")}] `;
      const prev = notesUpdate ?? existing.notes ?? "";
      notesUpdate = prev ? `${prev}\n${prefix}${body.checkinNotes}` : `${prefix}${body.checkinNotes}`;
    }
    if (body.checkoutNotes) {
      const prefix = `[צ׳ק-אאוט ${new Date().toLocaleString("he-IL")}] `;
      const prev = notesUpdate ?? existing.notes ?? "";
      notesUpdate = prev ? `${prev}\n${prefix}${body.checkoutNotes}` : `${prefix}${body.checkoutNotes}`;
    }

    // If actualCheckinTime provided, use it as checkIn
    // If actualCheckoutTime provided, use it for actual checkout
    const stay = await prisma.boardingStay.update({
      where: { id: params.id },
      data: {
        ...(body.checkIn !== undefined && { checkIn: new Date(body.checkIn) }),
        ...(body.actualCheckinTime && { checkIn: new Date(body.actualCheckinTime) }),
        ...(body.checkOut !== undefined && { checkOut: body.checkOut ? new Date(body.checkOut) : null }),
        ...(body.actualCheckoutTime && { checkOut: new Date(body.actualCheckoutTime) }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.roomId !== undefined && { roomId: body.roomId }),
        ...(notesUpdate !== undefined && { notes: notesUpdate }),
      },
      include: {
        room: true,
        pet: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    // Auto-set room to "needs_cleaning" when checking out
    if (body.status === "checked_out" && existing.roomId) {
      // Check if there are other active stays in this room
      const otherActive = await prisma.boardingStay.count({
        where: {
          roomId: existing.roomId,
          id: { not: params.id },
          status: { in: ["reserved", "checked_in"] },
        },
      });
      // Only set needs_cleaning if no other active stays remain
      if (otherActive === 0) {
        await prisma.room.update({
          where: { id: existing.roomId },
          data: { status: "needs_cleaning" },
        });
      }
    }

    // Auto-set room to "available" when checking in (clear needs_cleaning)
    if (body.status === "checked_in" && existing.roomId) {
      const room = await prisma.room.findUnique({ where: { id: existing.roomId } });
      if (room && room.status === "needs_cleaning") {
        await prisma.room.update({
          where: { id: existing.roomId },
          data: { status: "available" },
        });
      }
    }

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
