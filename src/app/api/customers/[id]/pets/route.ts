import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const pet = await prisma.pet.create({
      data: {
        name: body.name,
        species: body.species || "dog",
        breed: body.breed || null,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        weight: body.weight ? parseFloat(body.weight) : null,
        gender: body.gender || null,
        medicalNotes: body.medicalNotes || null,
        customerId: params.id,
      },
    });

    await prisma.timelineEvent.create({
      data: {
        type: "pet_added",
        description: `חיית מחמד חדשה נוספה: ${pet.name}`,
        customerId: params.id,
        businessId: DEMO_BUSINESS_ID,
      },
    });

    return NextResponse.json(pet);
  } catch (error) {
    console.error("Pet POST error:", error);
    return NextResponse.json(
      { error: "Failed to create pet" },
      { status: 500 }
    );
  }
}
