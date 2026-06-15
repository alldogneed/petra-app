export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { updateMedication, deleteMedication, ServiceError } from "@/services/pets";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { petId: string; medId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    let updated;
    try {
      updated = await updateMedication(authResult.businessId, prisma, params.petId, params.medId, body);
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 400 });
      }
      throw e;
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH medication error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון תרופה" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { petId: string; medId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    try {
      await deleteMedication(authResult.businessId, prisma, params.petId, params.medId);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE medication error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת תרופה" }, { status: 500 });
  }
}
