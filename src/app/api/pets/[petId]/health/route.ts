export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

async function verifyPet(petId: string, businessId: string) {
  return prisma.pet.findFirst({
    where: { id: petId, customer: { businessId } },
  });
}

// PATCH /api/pets/[petId]/health — upsert DogHealth
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
    const dateFields = [
      "rabiesLastDate", "rabiesValidUntil",
      "dhppLastDate", "dhppPuppy1Date", "dhppPuppy2Date", "dhppPuppy3Date",
      "bordatellaDate", "parkWormDate", "dewormingLastDate",
      "fleaTickDate", "fleaTickExpiryDate",
    ];
    const stringFields = ["allergies", "medicalConditions", "surgeriesHistory", "activityLimitations", "vetName", "vetPhone", "originInfo", "timeWithOwner", "fleaTickType"];
    const boolFields = ["neuteredSpayed"];

    for (const f of dateFields) {
      if (f in body) data[f] = body[f] ? new Date(body[f]) : null;
    }
    for (const f of stringFields) {
      if (f in body) data[f] = body[f] || null;
    }
    for (const f of boolFields) {
      if (f in body) data[f] = Boolean(body[f]);
    }

    const health = await prisma.dogHealth.upsert({
      where: { petId: params.petId },
      create: { petId: params.petId, ...data },
      update: data,
    });

    return NextResponse.json(health);
  } catch (error) {
    console.error("PATCH health error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון נתוני בריאות" }, { status: 500 });
  }
}
