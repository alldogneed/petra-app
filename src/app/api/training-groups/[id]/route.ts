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

    const group = await prisma.trainingGroup.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: {
        participants: {
          include: {
            dog: true,
            customer: true,
          },
        },
        sessions: {
          orderBy: { sessionDatetime: "desc" },
          include: {
            attendance: {
              include: {
                participant: {
                  include: { dog: true, customer: true },
                },
              },
            },
          },
        },
        _count: {
          select: { participants: true, sessions: true },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "קבוצה לא נמצאה" }, { status: 404 });
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error("GET training group error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת קבוצה" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Verify group belongs to this business
    const existing = await prisma.trainingGroup.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "קבוצה לא נמצאה" }, { status: 404 });
    }

    const body = await request.json();

    const group = await prisma.trainingGroup.update({
      where: { id: params.id, businessId: authResult.businessId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.groupType !== undefined && { groupType: body.groupType }),
        ...(body.location !== undefined && { location: body.location }),
        ...(body.defaultDayOfWeek !== undefined && { defaultDayOfWeek: body.defaultDayOfWeek }),
        ...(body.defaultTime !== undefined && { defaultTime: body.defaultTime }),
        ...(body.maxParticipants !== undefined && { maxParticipants: body.maxParticipants }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    return NextResponse.json(group);
  } catch (error) {
    console.error("PATCH training group error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון קבוצה" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.trainingGroup.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "קבוצה לא נמצאה" }, { status: 404 });
    }

    await prisma.trainingGroup.delete({ where: { id: params.id, businessId: authResult.businessId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE training group error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת קבוצה" }, { status: 500 });
  }
}
