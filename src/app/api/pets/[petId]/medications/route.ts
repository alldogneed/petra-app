export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

async function verifyPet(petId: string, businessId: string) {
  return prisma.pet.findFirst({
    where: { id: petId, customer: { businessId } },
  });
}

// GET /api/pets/[petId]/medications
export async function GET(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const pet = await verifyPet(params.petId, businessId);
    if (!pet) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

    const medications = await prisma.dogMedication.findMany({
      where: { petId: params.petId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(medications);
  } catch (error) {
    console.error("GET medications error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת תרופות" }, { status: 500 });
  }
}

// POST /api/pets/[petId]/medications
export async function POST(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const pet = await verifyPet(params.petId, businessId);
    if (!pet) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

    const body = await request.json();
    const { medName, dosage, frequency, times, instructions, startDate, endDate } = body;

    if (!medName?.trim()) {
      return NextResponse.json({ error: "שם תרופה הוא שדה חובה" }, { status: 400 });
    }

    const medication = await prisma.dogMedication.create({
      data: {
        petId: params.petId,
        medName: medName.trim(),
        dosage: dosage?.trim() || null,
        frequency: frequency?.trim() || null,
        times: times?.trim() || null,
        instructions: instructions?.trim() || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    return NextResponse.json(medication, { status: 201 });
  } catch (error) {
    console.error("POST medication error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת תרופה" }, { status: 500 });
  }
}
