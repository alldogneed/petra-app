export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// POST /api/pets/[id]/medications
// Body: { medName, dosage?, frequency?, times?, instructions?, startDate?, endDate? }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Verify the pet belongs to this business
    const pet = await prisma.pet.findFirst({
      where: {
        id: params.id,
        customer: { businessId: authResult.businessId },
      },
      select: { id: true, name: true },
    });

    if (!pet) {
      return NextResponse.json({ error: "חיה לא נמצאה" }, { status: 404 });
    }

    const body = await request.json();

    if (!body.medName || !String(body.medName).trim()) {
      return NextResponse.json(
        { error: "שם התרופה הוא שדה חובה" },
        { status: 400 }
      );
    }

    const medication = await prisma.dogMedication.create({
      data: {
        petId: pet.id,
        medName: String(body.medName).trim(),
        dosage: body.dosage ?? null,
        frequency: body.frequency ?? null,
        times: body.times ?? null,
        instructions: body.instructions ?? null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
      },
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            customer: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(medication, { status: 201 });
  } catch (error) {
    console.error("POST /api/pets/[id]/medications error:", error);
    return NextResponse.json(
      { error: "שגיאה בהוספת תרופה" },
      { status: 500 }
    );
  }
}
