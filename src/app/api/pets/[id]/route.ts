export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const pet = await prisma.pet.findFirst({
      where: {
        id: params.id,
        customer: { businessId: DEMO_BUSINESS_ID },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        health: true,
        behavior: true,
        medications: { orderBy: { createdAt: "desc" } },
        appointments: {
          include: { service: { select: { name: true } } },
          orderBy: { date: "desc" },
          take: 20,
        },
        boardingStays: {
          include: { room: { select: { name: true } } },
          orderBy: { checkIn: "desc" },
          take: 10,
        },
        trainingPrograms: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!pet) {
      return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    }

    return NextResponse.json(pet);
  } catch (error) {
    console.error("GET pet error:", error);
    return NextResponse.json({ error: "Failed to fetch pet" }, { status: 500 });
  }
}

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
        ...(petData.foodNotes !== undefined && { foodNotes: petData.foodNotes || null }),
        ...(petData.behaviorNotes !== undefined && { behaviorNotes: petData.behaviorNotes || null }),
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
