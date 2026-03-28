export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import type { VaccinePlan } from "@/lib/vaccine-plan";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const dogType = searchParams.get("dogType"); // "adults" | "puppies"

    // Exclude retired/decertified dogs from vaccinations view
    const EXCLUDED_PHASES = ["RETIRED", "DECERTIFIED"];
    // Young group: גור + באימון; Adult group: everything else (except excluded)
    const YOUNG_PHASES = ["PUPPY", "IN_TRAINING"];

    const dogs = await prisma.serviceDogProfile.findMany({
      where: {
        businessId: authResult.businessId,
        phase: { notIn: EXCLUDED_PHASES },
      },
      include: {
        pet: { select: { id: true, name: true, breed: true, birthDate: true } },
        medicalProtocols: {
          select: { id: true, protocolKey: true, status: true, completedDate: true, dueDate: true, expiryDate: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const isYoungDog = (dog: typeof dogs[0]) => YOUNG_PHASES.includes(dog.phase);

    const filtered = dogType
      ? dogs.filter(d => dogType === "puppies" ? isYoungDog(d) : !isYoungDog(d))
      : dogs;

    const result = filtered.map((dog) => ({
      id: dog.id,
      petId: dog.pet.id,
      petName: dog.pet.name,
      petBreed: dog.pet.breed,
      phase: dog.phase,
      currentLocation: dog.currentLocation,
      vaccinePlan: (dog.vaccinePlan as VaccinePlan) || {},
      protocols: dog.medicalProtocols,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/service-dogs/vaccinations error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת נתוני חיסונים" }, { status: 500 });
  }
}
