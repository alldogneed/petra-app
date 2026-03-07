export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// POST /api/service-dogs/sync-training
// Ensures every ServiceDogProfile has a matching TrainingProgram(SERVICE_DOG).
// Safe to call multiple times — idempotent.
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const dogs = await prisma.serviceDogProfile.findMany({
      where: { businessId: authResult.businessId },
      include: { pet: true },
    });

    let created = 0;
    for (const dog of dogs) {
      const existing = await prisma.trainingProgram.findFirst({
        where: { dogId: dog.petId, trainingType: "SERVICE_DOG", businessId: authResult.businessId },
      });
      if (!existing) {
        await prisma.trainingProgram.create({
          data: {
            businessId: authResult.businessId,
            dogId: dog.petId,
            customerId: dog.pet.customerId || null,
            name: `הכשרת כלב שירות — ${dog.pet.name}`,
            programType: "SD_FOUNDATION",
            trainingType: "SERVICE_DOG",
            status: ["RETIRED", "DECERTIFIED"].includes(dog.phase) ? "COMPLETED" : "ACTIVE",
            startDate: dog.createdAt,
          },
        });
        created++;
      }
    }

    return NextResponse.json({ synced: dogs.length, created });
  } catch (error) {
    console.error("POST /api/service-dogs/sync-training error:", error);
    return NextResponse.json({ error: "שגיאה בסנכרון תוכניות אילוף" }, { status: 500 });
  }
}
