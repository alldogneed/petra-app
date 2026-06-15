export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { updatePetHealth, ServiceError } from "@/services/pets";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { petId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    let health;
    try {
      health = await updatePetHealth(authResult.businessId, prisma, params.petId, body);
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 400 });
      }
      throw e;
    }

    return NextResponse.json(health);
  } catch (error) {
    console.error("PATCH health error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון נתוני בריאות" }, { status: 500 });
  }
}
