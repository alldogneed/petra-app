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

    const existing = await prisma.trainingPackage.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "חבילה לא נמצאה" }, { status: 404 });
    }

    const body = await request.json();

    // Validate numeric fields
    if (body.sessions !== undefined) {
      const n = parseInt(body.sessions);
      if (!Number.isFinite(n) || n < 1) {
        return NextResponse.json({ error: "מספר מפגשים חייב להיות מספר חיובי" }, { status: 400 });
      }
    }
    if (body.price !== undefined) {
      const n = parseFloat(body.price);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: "מחיר לא תקין" }, { status: 400 });
      }
    }
    if (body.durationDays !== undefined && body.durationDays) {
      const n = parseInt(body.durationDays);
      if (!Number.isFinite(n) || n < 1) {
        return NextResponse.json({ error: "משך ימים לא תקין" }, { status: 400 });
      }
    }
    // Validate string lengths
    if (body.name !== undefined && (typeof body.name !== "string" || body.name.length > 200)) {
      return NextResponse.json({ error: "שם חבילה ארוך מדי (מקסימום 200 תווים)" }, { status: 400 });
    }
    if (body.description !== undefined && typeof body.description === "string" && body.description.length > 2000) {
      return NextResponse.json({ error: "תיאור ארוך מדי (מקסימום 2000 תווים)" }, { status: 400 });
    }

    const pkg = await prisma.trainingPackage.update({
      where: { id: params.id, businessId: authResult.businessId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.sessions !== undefined && { sessions: parseInt(body.sessions) }),
        ...(body.durationDays !== undefined && { durationDays: body.durationDays ? parseInt(body.durationDays) : null }),
        ...(body.price !== undefined && { price: parseFloat(body.price) }),
        ...(body.description !== undefined && { description: body.description || null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
      include: {
        _count: { select: { programs: true } },
      },
    });

    return NextResponse.json(pkg);
  } catch (error) {
    console.error("PATCH training-package error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון חבילה" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.trainingPackage.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: { _count: { select: { programs: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "חבילה לא נמצאה" }, { status: 404 });
    }

    if (existing._count.programs > 0) {
      return NextResponse.json(
        { error: `לא ניתן למחוק — יש ${existing._count.programs} תוכניות המשויכות לחבילה זו` },
        { status: 409 }
      );
    }

    await prisma.trainingPackage.delete({ where: { id: params.id, businessId: authResult.businessId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE training-package error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת חבילה" }, { status: 500 });
  }
}
