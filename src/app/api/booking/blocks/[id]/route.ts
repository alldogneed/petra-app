import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

// DELETE - remove a block
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Verify the block belongs to the business
    const block = await prisma.availabilityBlock.findFirst({
      where: { id: params.id, businessId: DEMO_BUSINESS_ID },
    });

    if (!block) {
      return NextResponse.json({ error: "חסימה לא נמצאה" }, { status: 404 });
    }

    await prisma.availabilityBlock.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE block error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת חסימה" }, { status: 500 });
  }
}
