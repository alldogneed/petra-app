export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { seedMedicalProtocols } from "@/lib/service-dog-engine";
import { computeMedicalComplianceStatus } from "@/lib/service-dog-engine";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const phase = searchParams.get("phase");
    const trainingStatus = searchParams.get("trainingStatus");

    const dogs = await prisma.serviceDogProfile.findMany({
      where: {
        businessId: authResult.businessId,
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
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:service-dogs:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();
    const { petId, phase, serviceType, notes } = body;

    if (!petId) {
      return NextResponse.json({ error: "נדרש לבחור חיית מחמד" }, { status: 400 });
    }

    // Verify pet belongs to business (via customer or directly)
    const pet = await prisma.pet.findFirst({
      where: {
        id: petId,
        OR: [
          { customer: { businessId: authResult.businessId } },
          { businessId: authResult.businessId },
        ],
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

    const profile = await prisma.$transaction(async (tx) => {
      const p = await tx.serviceDogProfile.create({
        data: {
          petId,
          businessId: authResult.businessId,
          phase: initialPhase,
          serviceType: serviceType || null,
          notes: notes || null,
        },
        include: { pet: true },
      });

      // Auto-create TrainingProgram so the dog immediately appears in the training tab
      const existingProgram = await tx.trainingProgram.findFirst({
        where: { dogId: petId, trainingType: "SERVICE_DOG", businessId: authResult.businessId },
      });
      if (!existingProgram) {
        await tx.trainingProgram.create({
          data: {
            businessId: authResult.businessId,
            dogId: petId,
            customerId: pet.customerId || null,
            name: `הכשרת כלב שירות — ${pet.name}`,
            programType: "SD_FOUNDATION",
            trainingType: "SERVICE_DOG",
            status: "ACTIVE",
            startDate: new Date(),
          },
        });
      }

      return p;
    });

    // Seed initial medical protocols
    await seedMedicalProtocols(profile.id, authResult.businessId, initialPhase);

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error("POST /api/service-dogs error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת פרופיל כלב שירות" }, { status: 500 });
  }
}
