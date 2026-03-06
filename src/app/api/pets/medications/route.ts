export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

/**
 * GET /api/pets/medications
 * Returns all pets with active medications across the business.
 * A medication is "active" if:
 *   - no endDate set (ongoing), OR
 *   - endDate >= today
 * Optional ?boarded=true to filter only pets currently in boarding.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const boardedOnly = searchParams.get("boarded") === "true";

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Find pets with active medications
    const medications = await prisma.dogMedication.findMany({
      where: {
        pet: { customer: { businessId: authResult.businessId } },
        AND: [
          {
            OR: [
              { endDate: null },
              { endDate: { gte: now } },
            ],
          },
          {
            OR: [
              { startDate: null },
              { startDate: { lte: new Date() } },
            ],
          },
        ],
      },
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            species: true,
            breed: true,
            customer: {
              select: { id: true, name: true, phone: true },
            },
          },
        },
      },
      orderBy: { petId: "asc" },
    });

    // If boarded=true, filter to only pets currently checked-in to boarding
    let result = medications;
    if (boardedOnly) {
      const checkedInPetIds = await prisma.boardingStay.findMany({
        where: {
          pet: { customer: { businessId: authResult.businessId } },
          status: "checked_in",
        },
        select: { petId: true },
      });
      const boardedPetSet = new Set(checkedInPetIds.map((s) => s.petId));
      result = medications.filter((m) => boardedPetSet.has(m.petId));
    }

    // Group by pet
    const byPet = new Map<string, { pet: typeof medications[0]["pet"]; meds: typeof medications }>();
    for (const med of result) {
      const existing = byPet.get(med.petId);
      if (existing) {
        existing.meds.push(med);
      } else {
        byPet.set(med.petId, { pet: med.pet, meds: [med] });
      }
    }

    const grouped = Array.from(byPet.values()).map(({ pet, meds }) => ({
      petId: pet.id,
      petName: pet.name,
      species: pet.species,
      breed: pet.breed,
      customerId: pet.customer?.id ?? "",
      customerName: pet.customer?.name ?? "",
      customerPhone: pet.customer?.phone ?? "",
      medications: meds.map((m) => ({
        id: m.id,
        medName: m.medName,
        dosage: m.dosage,
        frequency: m.frequency,
        times: m.times,
        instructions: m.instructions,
        startDate: m.startDate,
        endDate: m.endDate,
      })),
    }));

    return NextResponse.json({ pets: grouped, total: grouped.length });
  } catch (error) {
    console.error("GET pets/medications error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת תרופות" }, { status: 500 });
  }
}
