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

    const dogs = await prisma.serviceDogProfile.findMany({
      where: { businessId: authResult.businessId },
      include: {
        pet: { select: { id: true, name: true, breed: true, birthDate: true } },
        medicalProtocols: {
          select: { id: true, protocolKey: true, status: true, completedDate: true, dueDate: true, expiryDate: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Classify puppy vs adult by birth date (< 12 months = puppy); fallback to phase
    const isPuppyDog = (dog: typeof dogs[0]) => {
      const bd = dog.pet.birthDate;
      if (!bd) return dog.phase === "PUPPY";
      const ageMonths = (Date.now() - new Date(bd).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      return ageMonths < 12;
    };

    const filtered = dogType
      ? dogs.filter(d => dogType === "puppies" ? isPuppyDog(d) : !isPuppyDog(d))
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
