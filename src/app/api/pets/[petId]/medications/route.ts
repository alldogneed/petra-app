export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { listPetMedications, createMedication, ServiceError } from "@/services/pets";

export async function GET(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    let medications;
    try {
      medications = await listPetMedications(authResult.businessId, prisma, params.petId);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(medications);
  } catch (error) {
    console.error("GET medications error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת תרופות" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    let medication;
    try {
      medication = await createMedication(authResult.businessId, prisma, params.petId, body);
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 400 });
      }
      throw e;
    }

    return NextResponse.json(medication, { status: 201 });
  } catch (error) {
    console.error("POST medication error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת תרופה" }, { status: 500 });
  }
}
