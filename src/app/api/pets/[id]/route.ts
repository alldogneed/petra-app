import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { neuteredSpayed, ...petData } = body;

    const pet = await prisma.pet.update({
      where: { id: params.id },
      data: {
        ...(petData.name !== undefined && { name: petData.name }),
        ...(petData.breed !== undefined && { breed: petData.breed || null }),
        ...(petData.gender !== undefined && { gender: petData.gender || null }),
        ...(petData.weight !== undefined && { weight: petData.weight ? parseFloat(petData.weight) : null }),
        ...(petData.birthDate !== undefined && { birthDate: petData.birthDate ? new Date(petData.birthDate) : null }),
        ...(petData.microchip !== undefined && { microchip: petData.microchip || null }),
        ...(petData.tags !== undefined && { tags: petData.tags }),
        ...(petData.attachments !== undefined && { attachments: petData.attachments }),
        ...(petData.medicalNotes !== undefined && { medicalNotes: petData.medicalNotes || null }),
      },
      include: {
        health: true,
        behavior: true,
      },
    });

    // Handle neuteredSpayed via DogHealth
    if (neuteredSpayed !== undefined) {
      await prisma.dogHealth.upsert({
        where: { petId: params.id },
        create: { petId: params.id, neuteredSpayed: Boolean(neuteredSpayed) },
        update: { neuteredSpayed: Boolean(neuteredSpayed) },
      });
    }

    return NextResponse.json(pet);
  } catch (error) {
    console.error("PATCH pet error:", error);
    return NextResponse.json({ error: "Failed to update pet" }, { status: 500 });
  }
}
