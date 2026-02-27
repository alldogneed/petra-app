export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

// PATCH /api/scheduled-messages/[id] — cancel a pending message
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.scheduledMessage.findFirst({
      where: { id: params.id, businessId: DEMO_BUSINESS_ID },
    });
    if (!existing) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "ניתן לבטל רק הודעות ממתינות" }, { status: 400 });
    }

    const updated = await prisma.scheduledMessage.update({
      where: { id: params.id },
      data: { status: "CANCELED" },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH scheduled-message error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון הודעה" }, { status: 500 });
  }
}
