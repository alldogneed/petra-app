export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { listPets } from "@/services/pets";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const pets = await listPets(authResult.businessId, prisma, {
      search: searchParams.get("search") || searchParams.get("q") || undefined,
      species: searchParams.get("species") || undefined,
    });

    return NextResponse.json({ pets, total: pets.length });
  } catch (error) {
    console.error("GET /api/pets error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת חיות" }, { status: 500 });
  }
}
