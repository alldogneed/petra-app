export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

async function verifyPet(petId: string, businessId: string) {
  return prisma.pet.findFirst({
    where: {
      id: petId,
      OR: [{ customer: { businessId } }, { businessId }],
    },
  });
}

// PATCH /api/pets/[petId]/behavior — upsert DogBehavior
export async function PATCH(
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

    const data: Record<string, unknown> = {};
    const boolFields = [
      "dogAggression", "humanAggression", "leashReactivity", "leashPulling",
      "jumping", "separationAnxiety", "excessiveBarking", "destruction",
      "resourceGuarding", "fears", "badWithKids", "houseSoiling",
      "biteHistory", "priorTraining",
    ];
    const stringFields = ["biteDetails", "triggers", "priorTrainingDetails"];

    for (const f of boolFields) {
      if (f in body) data[f] = Boolean(body[f]);
    }
    for (const f of stringFields) {
      if (f in body) data[f] = body[f] || null;
    }
    if ("customIssues" in body) {
      const arr = Array.isArray(body.customIssues) ? body.customIssues : [];
      data.customIssues = arr.length > 0 ? JSON.stringify(arr) : null;
    }

    const behavior = await prisma.dogBehavior.upsert({
      where: { petId: params.petId },
      create: { petId: params.petId, ...data },
      update: data,
    });

    return NextResponse.json(behavior);
  } catch (error) {
    console.error("PATCH behavior error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון נתוני התנהגות" }, { status: 500 });
  }
}
