export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { updateTrainingPackage, deleteTrainingPackage, ServiceError } from "@/services/training";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

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
    if (body.name !== undefined && (typeof body.name !== "string" || body.name.length > 200)) {
      return NextResponse.json({ error: "שם חבילה ארוך מדי (מקסימום 200 תווים)" }, { status: 400 });
    }
    if (body.description !== undefined && typeof body.description === "string" && body.description.length > 2000) {
      return NextResponse.json({ error: "תיאור ארוך מדי (מקסימום 2000 תווים)" }, { status: 400 });
    }

    let pkg;
    try {
      pkg = await updateTrainingPackage(authResult.businessId, prisma, params.id, {
        name: body.name,
        type: body.type,
        sessions: body.sessions !== undefined ? parseInt(body.sessions) : undefined,
        durationDays: body.durationDays !== undefined ? (body.durationDays ? parseInt(body.durationDays) : null) : undefined,
        price: body.price !== undefined ? parseFloat(body.price) : undefined,
        description: body.description,
        isActive: body.isActive,
      });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "חבילה לא נמצאה" }, { status: 404 });
      }
      throw e;
    }

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

    try {
      await deleteTrainingPackage(authResult.businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json(
          { error: e.message },
          { status: e.code === "NOT_FOUND" ? 404 : e.code === "CONFLICT" ? 409 : 400 }
        );
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE training-package error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת חבילה" }, { status: 500 });
  }
}
