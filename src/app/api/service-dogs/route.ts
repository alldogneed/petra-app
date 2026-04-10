export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { seedMedicalProtocols } from "@/lib/service-dog-engine";
import { computeMedicalComplianceStatus } from "@/lib/service-dog-engine";
import { SERVICE_DOG_PHASES, SERVICE_DOG_TYPES, LOCATION_OPTIONS } from "@/lib/service-dogs";

const VALID_PHASES: string[] = SERVICE_DOG_PHASES.map((p) => p.id);
const VALID_SERVICE_TYPES: string[] = SERVICE_DOG_TYPES.map((t) => t.id);
const VALID_LOCATIONS: string[] = LOCATION_OPTIONS.map((l) => l.id);
const VALID_TRAINING_STATUSES: string[] = ["NOT_STARTED", "IN_PROGRESS", "PENDING_CERT", "CERTIFIED", "FAILED", "ON_HOLD"];

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const phase = searchParams.get("phase");
    const trainingStatus = searchParams.get("trainingStatus");
    const location = searchParams.get("location");

    if (phase && !VALID_PHASES.includes(phase)) {
      return NextResponse.json({ error: "שלב לא חוקי" }, { status: 400 });
    }
    if (trainingStatus && !VALID_TRAINING_STATUSES.includes(trainingStatus)) {
      return NextResponse.json({ error: "סטטוס אימון לא חוקי" }, { status: 400 });
    }
    if (location && !VALID_LOCATIONS.includes(location)) {
      return NextResponse.json({ error: "מיקום לא חוקי" }, { status: 400 });
    }

    const dogs = await prisma.serviceDogProfile.findMany({
      where: {
        businessId: authResult.businessId,
        ...(phase && { phase }),
        ...(trainingStatus && { trainingStatus }),
        ...(location && { currentLocation: location }),
      },
      include: {
        pet: true,
        medicalProtocols: true,
        placements: {
          where: { status: "ACTIVE" },
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
    const { petId, petName, breed, species, phase, serviceType, notes } = body;

    if (!petId && !petName) {
      return NextResponse.json({ error: "נדרש לבחור חיית מחמד או להזין שם כלב" }, { status: 400 });
    }
    if (phase && !VALID_PHASES.includes(phase)) {
      return NextResponse.json({ error: "שלב לא חוקי" }, { status: 400 });
    }
    if (serviceType && !VALID_SERVICE_TYPES.includes(serviceType)) {
      return NextResponse.json({ error: "סוג שירות לא חוקי" }, { status: 400 });
    }

    // If no petId, create a standalone pet linked directly to the business
    let resolvedPetId = petId;
    if (!petId && petName) {
      const newPet = await prisma.pet.create({
        data: {
          name: petName,
          species: species || "dog",
          breed: breed || null,
          businessId: authResult.businessId,
        },
      });
      resolvedPetId = newPet.id;
    }

    // Verify pet belongs to business (via customer or directly) — include health for smart protocol seeding
    const pet = await prisma.pet.findFirst({
      where: {
        id: resolvedPetId,
        OR: [
          { customer: { businessId: authResult.businessId } },
          { businessId: authResult.businessId },
        ],
      },
      include: {
        health: {
          select: {
            rabiesLastDate: true,
            rabiesValidUntil: true,
            dhppLastDate: true,
            bordatellaDate: true,
            dewormingLastDate: true,
            fleaTickExpiryDate: true,
          },
        },
      },
    });

    if (!pet) {
      return NextResponse.json({ error: "חיית מחמד לא נמצאה" }, { status: 404 });
    }

    // Check no existing profile
    const existing = await prisma.serviceDogProfile.findUnique({
      where: { petId: resolvedPetId },
    });

    if (existing) {
      return NextResponse.json({ error: "לכלב זה כבר קיים פרופיל כלב שירות" }, { status: 409 });
    }

    const initialPhase = phase || "SELECTION";

    // Pull business sdSettings to set default target hours
    const biz = await prisma.business.findUnique({
      where: { id: authResult.businessId },
      select: { sdSettings: true },
    });
    const sdSettings = biz?.sdSettings as { trackHours?: boolean; defaultTargetHours?: number } | null;
    const defaultTargetHours = sdSettings?.defaultTargetHours ?? 120;

    // Sequential operations (no interactive $transaction — Supabase PgBouncer incompatible)
    const profile = await prisma.serviceDogProfile.create({
      data: {
        petId: resolvedPetId,
        businessId: authResult.businessId,
        phase: initialPhase,
        serviceType: serviceType || null,
        notes: notes || null,
        trainingTargetHours: defaultTargetHours,
      },
      include: { pet: true },
    });

    // Auto-create TrainingProgram so the dog immediately appears in the training tab
    const existingProgram = await prisma.trainingProgram.findFirst({
      where: { dogId: resolvedPetId, trainingType: "SERVICE_DOG", businessId: authResult.businessId },
    });
    if (!existingProgram) {
      await prisma.trainingProgram.create({
        data: {
          businessId: authResult.businessId,
          dogId: resolvedPetId,
          customerId: pet.customerId || null,
          name: `הכשרת כלב שירות — ${pet.name}`,
          programType: "SD_FOUNDATION",
          trainingType: "SERVICE_DOG",
          status: "ACTIVE",
          startDate: new Date(),
        },
      });
    }

    // Seed initial medical protocols — use existing health data for smart dates
    await seedMedicalProtocols(profile.id, authResult.businessId, initialPhase, pet.health);

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error("POST /api/service-dogs error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת פרופיל כלב שירות" }, { status: 500 });
  }
}
