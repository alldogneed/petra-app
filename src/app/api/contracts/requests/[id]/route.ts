export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  try {
    const contract = await prisma.contractRequest.findFirst({
      where: { id: params.id, businessId },
      select: { id: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "חוזה לא נמצא" }, { status: 404 });
    }

    await prisma.contractRequest.delete({ where: { id: params.id, businessId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE contract request error:", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
