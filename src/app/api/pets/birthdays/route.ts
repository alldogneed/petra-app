export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { listPetBirthdays } from "@/services/pets";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") ?? "14", 10);

    const birthdays = await listPetBirthdays(authResult.businessId, prisma, { days });

    return NextResponse.json({ birthdays, total: birthdays.length });
  } catch (error) {
    console.error("GET pets/birthdays error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת ימי הולדת" }, { status: 500 });
  }
}
