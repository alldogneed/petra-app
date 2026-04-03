export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

/**
 * DELETE /api/boarding/care-log/[id]
 * Deletes a care log entry (undo), scoped to businessId.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const log = await prisma.boardingCareLog.findFirst({
      where: { id: params.id, businessId },
    });

    if (!log) {
      return NextResponse.json({ error: "רשומה לא נמצאה" }, { status: 404 });
    }

    await prisma.boardingCareLog.delete({ where: { id: params.id, businessId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE care-log error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת הרשומה" }, { status: 500 });
  }
}
