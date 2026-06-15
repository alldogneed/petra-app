export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { updateServiceDogPhase, ServiceError } from "@/services/service-dogs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { phase } = body;

    let updated;
    try {
      updated = await updateServiceDogPhase(authResult.businessId, prisma, params.id, phase);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "VALIDATION") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "כלב שירות לא נמצא" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/service-dogs/[id]/phase error:", error);
    return NextResponse.json({ error: "שגיאה בשינוי שלב" }, { status: 500 });
  }
}
