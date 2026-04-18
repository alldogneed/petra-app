export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const pets = await prisma.pet.findMany({
      where: {
        customerId: params.id,
        customer: { businessId: authResult.businessId },
      },
      select: { id: true, name: true, species: true, breed: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(pets);
  } catch (error) {
    console.error("Pets GET error:", error);
    return NextResponse.json({ error: "Failed to fetch pets" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Verify customer exists and belongs to this business
    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      select: { id: true, businessId: true },
    });
    if (!customer || customer.businessId !== authResult.businessId) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const body = await request.json();
    const { neuteredSpayed, behavioralTags, ...petFields } = body;

    // Input validation
    if (!petFields.name || typeof petFields.name !== "string" || !petFields.name.trim()) {
      return NextResponse.json({ error: "שם חיית מחמד חובה" }, { status: 400 });
    }
    if (petFields.name.length > 100) {
      return NextResponse.json({ error: "שם חיית מחמד ארוך מדי (מקסימום 100 תווים)" }, { status: 400 });
    }
    if (petFields.breed && petFields.breed.length > 100) {
      return NextResponse.json({ error: "גזע ארוך מדי (מקסימום 100 תווים)" }, { status: 400 });
    }
    if (petFields.medicalNotes && petFields.medicalNotes.length > 5000) {
      return NextResponse.json({ error: "הערות רפואיות ארוכות מדי (מקסימום 5000 תווים)" }, { status: 400 });
    }
    if (petFields.microchip && petFields.microchip.length > 50) {
      return NextResponse.json({ error: "מספר שבב ארוך מדי (מקסימום 50 תווים)" }, { status: 400 });
    }

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
        businessId: authResult.businessId,
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
