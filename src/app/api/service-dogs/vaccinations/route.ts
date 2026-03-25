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
      where: {
        businessId: authResult.businessId,
        ...(dogType === "puppies" ? { phase: "PUPPY" } : dogType === "adults" ? { phase: { not: "PUPPY" } } : {}),
      },
      include: {
        pet: { select: { id: true, name: true, breed: true } },
        medicalProtocols: {
          select: { id: true, protocolKey: true, status: true, completedDate: true, dueDate: true, expiryDate: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const result = dogs.map((dog) => ({
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
