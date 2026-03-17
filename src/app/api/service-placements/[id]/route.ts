export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { createComplianceEvent } from "@/lib/service-dog-engine";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const placement = await prisma.serviceDogPlacement.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: {
        serviceDog: { include: { pet: true } },
        recipient: true,
        complianceEvents: { orderBy: { eventAt: "desc" } },
      },
    });

    if (!placement) {
      return NextResponse.json({ error: "שיבוץ לא נמצא" }, { status: 404 });
    }

    return NextResponse.json(placement);
  } catch (error) {
    console.error("GET /api/service-placements/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת שיבוץ" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    const placement = await prisma.serviceDogPlacement.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: {
        serviceDog: { include: { pet: true } },
        recipient: true,
      },
    });

    if (!placement) {
      return NextResponse.json({ error: "שיבוץ לא נמצא" }, { status: 404 });
    }

    const oldStatus = placement.status;
    const newStatus = body.status || oldStatus;

    const updated = await prisma.serviceDogPlacement.update({
      where: { id: params.id, businessId: authResult.businessId },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.placementDate !== undefined && { placementDate: body.placementDate ? new Date(body.placementDate) : null }),
        ...(body.certifiedAt !== undefined && { certifiedAt: body.certifiedAt ? new Date(body.certifiedAt) : null }),
        ...(body.trialStartDate !== undefined && { trialStartDate: body.trialStartDate ? new Date(body.trialStartDate) : null }),
        ...(body.trialEndDate !== undefined && { trialEndDate: body.trialEndDate ? new Date(body.trialEndDate) : null }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.checkInNotes !== undefined && { checkInNotes: body.checkInNotes, lastCheckInAt: new Date() }),
        ...(body.nextCheckInAt !== undefined && { nextCheckInAt: body.nextCheckInAt ? new Date(body.nextCheckInAt) : null }),
        ...(body.terminationReason !== undefined && { terminationReason: body.terminationReason }),
        // Auto-set terminated date
        ...(newStatus === "TERMINATED" && oldStatus !== "TERMINATED" && { terminatedAt: new Date() }),
      },
      include: {
        serviceDog: { include: { pet: true } },
        recipient: true,
      },
    });

    // Create compliance event on termination
    if (oldStatus !== newStatus && newStatus === "TERMINATED") {
      await createComplianceEvent(
        placement.serviceDogId,
        authResult.businessId,
        "PLACEMENT_ENDED",
        `שיבוץ הסתיים: ${placement.serviceDog.pet.name} → ${placement.recipient.name}`,
        { placementId: params.id }
      );
      await prisma.serviceDogRecipient.update({
        where: { id: placement.recipientId },
        data: { status: "LEAD" },
      });
    }

    // Update recipient to ACTIVE when placement becomes ACTIVE
    if (oldStatus !== newStatus && newStatus === "ACTIVE") {
      await prisma.serviceDogRecipient.update({
        where: { id: placement.recipientId },
        data: { status: "ACTIVE" },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/service-placements/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון שיבוץ" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const placement = await prisma.serviceDogPlacement.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });

    if (!placement) {
      return NextResponse.json({ error: "שיבוץ לא נמצא" }, { status: 404 });
    }

    await prisma.serviceDogPlacement.delete({ where: { id: params.id } });

    // If it was an active placement, revert recipient to LEAD
    if (placement.status === "ACTIVE") {
      await prisma.serviceDogRecipient.update({
        where: { id: placement.recipientId },
        data: { status: "LEAD" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/service-placements/[id] error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת שיבוץ" }, { status: 500 });
  }
}
