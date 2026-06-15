export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { cancelScheduledMessage, ServiceError } from "@/services/notifications";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    let updated;
    try {
      updated = await cancelScheduledMessage(authResult.businessId, prisma, params.id);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
      }
      if (e instanceof ServiceError && e.code === "VALIDATION") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH scheduled-message error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון הודעה" }, { status: 500 });
  }
}
