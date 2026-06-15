export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { listAllMedications } from "@/services/pets";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const boardedOnly = searchParams.get("boarded") === "true";

    const pets = await listAllMedications(authResult.businessId, prisma, { boardedOnly });

    return NextResponse.json({ pets, total: pets.length });
  } catch (error) {
    console.error("GET pets/medications error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת תרופות" }, { status: 500 });
  }
}
