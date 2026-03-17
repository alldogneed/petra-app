export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { createComplianceEvent } from "@/lib/service-dog-engine";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const placements = await prisma.serviceDogPlacement.findMany({
      where: {
        businessId: authResult.businessId,
        ...(status && { status }),
      },
      include: {
        serviceDog: { include: { pet: true } },
        recipient: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(placements);
  } catch (error) {
    console.error("GET /api/service-placements error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת שיבוצים" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { serviceDogId, recipientId, placementDate, certifiedAt, trialStartDate, trialEndDate, notes, status: bodyStatus } = body;
    const VALID_STATUSES = ["ACTIVE", "TERMINATED"];
    const initialStatus = VALID_STATUSES.includes(bodyStatus) ? bodyStatus : "ACTIVE";

    if (!serviceDogId || !recipientId) {
      return NextResponse.json({ error: "נדרש כלב שירות ומקבל" }, { status: 400 });
    }

    // Verify both exist in business
    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: serviceDogId, businessId: authResult.businessId },
      include: { pet: true },
    });

    if (!dog) {
      return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
    }

    const recipient = await prisma.serviceDogRecipient.findFirst({
      where: { id: recipientId, businessId: authResult.businessId },
    });

    if (!recipient) {
      return NextResponse.json({ error: "מקבל לא נמצא" }, { status: 404 });
    }

    // Check for existing active placement
    const existingPlacement = await prisma.serviceDogPlacement.findFirst({
      where: {
        serviceDogId,
        recipientId,
        status: "ACTIVE",
      },
    });

    if (existingPlacement) {
      return NextResponse.json({ error: "שיבוץ פעיל כבר קיים עבור שילוב זה" }, { status: 409 });
    }

    const placement = await prisma.serviceDogPlacement.create({
      data: {
        businessId: authResult.businessId,
        serviceDogId,
        recipientId,
        placementDate: placementDate ? new Date(placementDate) : new Date(),
        certifiedAt: certifiedAt ? new Date(certifiedAt) : null,
        trialStartDate: trialStartDate ? new Date(trialStartDate) : null,
        trialEndDate: trialEndDate ? new Date(trialEndDate) : null,
        notes: notes || null,
        status: initialStatus,
      },
      include: {
        serviceDog: { include: { pet: true } },
        recipient: true,
      },
    });

    // Update recipient status
    await prisma.serviceDogRecipient.update({
      where: { id: recipientId },
      data: { status: "MATCHED" },
    });

    // Create compliance event
    await createComplianceEvent(
      serviceDogId,
      authResult.businessId,
      "PLACEMENT_STARTED",
      `שיבוץ חדש: ${dog.pet.name} → ${recipient.name}`,
      { placementId: placement.id }
    );

    return NextResponse.json(placement, { status: 201 });
  } catch (error) {
    console.error("POST /api/service-placements error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת שיבוץ" }, { status: 500 });
  }
}
