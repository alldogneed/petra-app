export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { listVaccinations } from "@/services/pets";
export type { VaccineType, VaccinationEntry } from "@/services/pets";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const allMode = searchParams.get("all") === "true";
    const days = parseInt(searchParams.get("days") ?? "30", 10);

    const vaccinations = await listVaccinations(authResult.businessId, prisma, {
      all: allMode,
      days: allMode ? undefined : days,
    });

    return NextResponse.json({ vaccinations, total: vaccinations.length });
  } catch (error) {
    console.error("GET pets/vaccinations error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת נתוני חיסונים" }, { status: 500 });
  }
}
