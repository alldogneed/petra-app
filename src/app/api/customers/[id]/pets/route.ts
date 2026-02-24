import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { logCurrentUserActivity } from "@/lib/activity-log";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { neuteredSpayed, behavioralTags, ...petFields } = body;

    const pet = await prisma.pet.create({
      data: {
        name: petFields.name,
        species: petFields.species || "dog",
        breed: petFields.breed || null,
        birthDate: petFields.birthDate ? new Date(petFields.birthDate) : null,
        weight: petFields.weight ? parseFloat(petFields.weight) : null,
        gender: petFields.gender || null,
        microchip: petFields.microchip || null,
        tags: behavioralTags ? JSON.stringify(behavioralTags) : "[]",
        medicalNotes: petFields.medicalNotes || null,
        customerId: params.id,
      },
    });

    // Handle neuteredSpayed via DogHealth
    if (neuteredSpayed !== undefined) {
      await prisma.dogHealth.upsert({
        where: { petId: pet.id },
        create: { petId: pet.id, neuteredSpayed: Boolean(neuteredSpayed) },
        update: { neuteredSpayed: Boolean(neuteredSpayed) },
      });
    }

    logCurrentUserActivity("ADD_PET");

    await prisma.timelineEvent.create({
      data: {
        type: "pet_added",
        description: `חיית מחמד חדשה נוספה: ${pet.name}`,
        customerId: params.id,
        businessId: DEMO_BUSINESS_ID,
      },
    });

    const petWithHealth = await prisma.pet.findUnique({
      where: { id: pet.id },
      include: {
        health: { select: { neuteredSpayed: true } },
      },
    });

    return NextResponse.json(petWithHealth);
  } catch (error) {
    console.error("Pet POST error:", error);
    return NextResponse.json(
      { error: "Failed to create pet" },
      { status: 500 }
    );
  }
}
