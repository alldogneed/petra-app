export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { createComplianceEvent } from "@/lib/service-dog-engine";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const placements = await prisma.serviceDogPlacement.findMany({
      where: {
        businessId: DEMO_BUSINESS_ID,
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
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { serviceDogId, recipientId, placementDate, trialStartDate, trialEndDate, notes } = body;

    if (!serviceDogId || !recipientId) {
      return NextResponse.json({ error: "נדרש כלב שירות ומקבל" }, { status: 400 });
    }

    // Verify both exist in business
    const dog = await prisma.serviceDogProfile.findFirst({
      where: { id: serviceDogId, businessId: DEMO_BUSINESS_ID },
      include: { pet: true },
    });

    if (!dog) {
      return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
    }

    const recipient = await prisma.serviceDogRecipient.findFirst({
      where: { id: recipientId, businessId: DEMO_BUSINESS_ID },
    });

    if (!recipient) {
      return NextResponse.json({ error: "מקבל לא נמצא" }, { status: 404 });
    }

    // Check for existing active placement
    const existingPlacement = await prisma.serviceDogPlacement.findFirst({
      where: {
        serviceDogId,
        recipientId,
        status: { in: ["PENDING", "TRIAL", "ACTIVE"] },
      },
    });

    if (existingPlacement) {
      return NextResponse.json({ error: "שיבוץ פעיל כבר קיים עבור שילוב זה" }, { status: 409 });
    }

    const placement = await prisma.serviceDogPlacement.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
        serviceDogId,
        recipientId,
        placementDate: placementDate ? new Date(placementDate) : new Date(),
        trialStartDate: trialStartDate ? new Date(trialStartDate) : null,
        trialEndDate: trialEndDate ? new Date(trialEndDate) : null,
        notes: notes || null,
        status: "PENDING",
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
      DEMO_BUSINESS_ID,
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
