export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { seedMedicalProtocols } from "@/lib/service-dog-engine";

// POST /api/service-dogs/standalone-pet
// Creates a standalone Pet (no customer) + ServiceDogProfile in one call
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:service-dogs:standalone-pet", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();
    const { name, breed, gender, birthDate, weight, microchip, medicalNotes, behaviorNotes, notes, phase, serviceType } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "נדרש שם כלב" }, { status: 400 });
    }

    // Sequential operations (no interactive $transaction — Supabase PgBouncer incompatible)
    const pet = await prisma.pet.create({
      data: {
        name: name.trim(),
        species: "dog",
        breed: breed || null,
        gender: gender || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        weight: weight ? parseFloat(weight) : null,
        microchip: microchip || null,
        medicalNotes: medicalNotes || null,
        behaviorNotes: behaviorNotes || null,
        businessId: authResult.businessId,
        // customerId is null — standalone service dog
      },
    });

    const initialPhase = phase || "SELECTION";

    const result = await prisma.serviceDogProfile.create({
      data: {
        petId: pet.id,
        businessId: authResult.businessId,
        phase: initialPhase,
        serviceType: serviceType || null,
        notes: notes || null,
      },
      include: { pet: true },
    });

    // Auto-create a TrainingProgram so the dog appears in the training tab
    await prisma.trainingProgram.create({
      data: {
        businessId: authResult.businessId,
        dogId: pet.id,
        customerId: null,
        name: `הכשרת כלב שירות — ${name.trim()}`,
        programType: "SD_FOUNDATION",
        trainingType: "SERVICE_DOG",
        status: "ACTIVE",
        startDate: new Date(),
      },
    });

    // Seed initial medical protocols outside transaction
    await seedMedicalProtocols(result.id, authResult.businessId, result.phase);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/service-dogs/standalone-pet error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת כלב שירות" }, { status: 500 });
  }
}

// GET /api/service-dogs/standalone-pet — list standalone service dog pets for this business
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const pets = await prisma.pet.findMany({
      where: { businessId: authResult.businessId, customerId: null },
      include: { serviceDogProfile: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(pets);
  } catch (error) {
    console.error("GET /api/service-dogs/standalone-pet error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת כלבים" }, { status: 500 });
  }
}
