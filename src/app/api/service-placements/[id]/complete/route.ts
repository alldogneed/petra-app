export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { createComplianceEvent } from "@/lib/service-dog-engine";

// POST /api/service-placements/[id]/complete
// Terminates the placement process:
// - Sets placement status to TERMINATED
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
      include: { serviceDog: { include: { pet: true } }, recipient: true },
    });

    if (!placement) {
      return NextResponse.json({ error: "שיבוץ לא נמצא" }, { status: 404 });
    }

    // Atomically terminate the whole process
    const [updatedPlacement] = await prisma.$transaction([
      prisma.serviceDogPlacement.update({
        where: { id: params.id, businessId: authResult.businessId },
        data: { status: "TERMINATED", terminatedAt: new Date() },
      }),
      prisma.serviceDogProfile.update({
        where: { id: placement.serviceDogId, businessId: authResult.businessId },
        data: { phase: "RETIRED" },
      }),
      prisma.serviceDogRecipient.update({
        where: { id: placement.recipientId, businessId: authResult.businessId },
        data: { status: "CLOSED" },
      }),
    ]);

    // Create compliance event
    await createComplianceEvent(
      placement.serviceDogId,
      authResult.businessId,
      "PLACEMENT_ENDED",
      `שיבוץ הסתיים: ${placement.serviceDog.pet.name} → ${placement.recipient.name}`,
      { placementId: params.id }
    );

    return NextResponse.json({ success: true, placement: updatedPlacement });
  } catch (error) {
    console.error("POST /api/service-placements/[id]/complete error:", error);
    return NextResponse.json({ error: "שגיאה בסיום התהליך" }, { status: 500 });
  }
}
