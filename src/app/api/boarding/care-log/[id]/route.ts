export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { deleteCareLogById, ServiceError } from "@/services/boarding";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    try {
      await deleteCareLogById(authResult.businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") return NextResponse.json({ error: "רשומה לא נמצאה" }, { status: 404 });
      throw e;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE care-log error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת הרשומה" }, { status: 500 });
  }
}
