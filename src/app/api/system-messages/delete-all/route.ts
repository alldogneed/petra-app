export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

/** DELETE /api/system-messages/delete-all — dismiss all system messages */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    await prisma.systemMessage.deleteMany({
      where: { businessId: authResult.businessId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE system-messages/delete-all error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת הודעות" }, { status: 500 });
  }
}
