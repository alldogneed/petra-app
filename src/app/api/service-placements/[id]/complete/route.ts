export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// POST /api/service-placements/[id]/complete
// Completes the training + placement process:
// - Sets placement status to COMPLETED
// - Sets service dog phase to RETIRED
// - Sets recipient status to CLOSED
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const placement = await prisma.serviceDogPlacement.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: { serviceDog: true, recipient: true },
    });

    if (!placement) {
      return NextResponse.json({ error: "שיבוץ לא נמצא" }, { status: 404 });
    }

    // Atomically complete the whole process
    const [updatedPlacement] = await prisma.$transaction([
      prisma.serviceDogPlacement.update({
        where: { id: params.id },
        data: { status: "COMPLETED", terminatedAt: new Date() },
      }),
      prisma.serviceDogProfile.update({
        where: { id: placement.serviceDogId },
        data: { phase: "RETIRED" },
      }),
      prisma.serviceDogRecipient.update({
        where: { id: placement.recipientId },
        data: { status: "CLOSED" },
      }),
    ]);

    return NextResponse.json({ success: true, placement: updatedPlacement });
  } catch (error) {
    console.error("POST /api/service-placements/[id]/complete error:", error);
    return NextResponse.json({ error: "שגיאה בסיום התהליך" }, { status: 500 });
  }
}
