import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { seedMedicalProtocols } from "@/lib/service-dog-engine";
import { computeMedicalComplianceStatus } from "@/lib/service-dog-engine";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const phase = searchParams.get("phase");
    const trainingStatus = searchParams.get("trainingStatus");

    const dogs = await prisma.serviceDogProfile.findMany({
      where: {
        businessId: DEMO_BUSINESS_ID,
        ...(phase && { phase }),
        ...(trainingStatus && { trainingStatus }),
      },
      include: {
        pet: true,
        medicalProtocols: true,
        placements: {
          where: { status: { in: ["ACTIVE", "TRIAL"] } },
          include: { recipient: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = dogs.map((dog) => ({
      ...dog,
      medicalCompliance: computeMedicalComplianceStatus(dog.medicalProtocols, dog.phase),
      activePlacement: dog.placements[0]
        ? {
            id: dog.placements[0].id,
            recipientName: dog.placements[0].recipient.name,
            status: dog.placements[0].status,
          }
        : null,
      medicalProtocols: undefined,
      placements: undefined,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/service-dogs error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת כלבי שירות" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { petId, phase, serviceType, notes } = body;

    if (!petId) {
      return NextResponse.json({ error: "נדרש לבחור חיית מחמד" }, { status: 400 });
    }

    // Verify pet belongs to business
    const pet = await prisma.pet.findFirst({
      where: {
        id: petId,
        customer: { businessId: DEMO_BUSINESS_ID },
      },
    });

    if (!pet) {
      return NextResponse.json({ error: "חיית מחמד לא נמצאה" }, { status: 404 });
    }

    // Check no existing profile
    const existing = await prisma.serviceDogProfile.findUnique({
      where: { petId },
    });

    if (existing) {
      return NextResponse.json({ error: "לכלב זה כבר קיים פרופיל כלב שירות" }, { status: 409 });
    }

    const initialPhase = phase || "SELECTION";

    const profile = await prisma.serviceDogProfile.create({
      data: {
        petId,
        businessId: DEMO_BUSINESS_ID,
        phase: initialPhase,
        serviceType: serviceType || null,
        notes: notes || null,
      },
      include: { pet: true },
    });

    // Seed initial medical protocols
    await seedMedicalProtocols(profile.id, DEMO_BUSINESS_ID, initialPhase);

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error("POST /api/service-dogs error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת פרופיל כלב שירות" }, { status: 500 });
  }
}
