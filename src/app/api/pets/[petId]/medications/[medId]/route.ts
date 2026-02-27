export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

async function verifyMed(petId: string, medId: string) {
  return prisma.dogMedication.findFirst({
    where: { id: medId, petId, pet: { customer: { businessId: DEMO_BUSINESS_ID } } },
  });
}

// PATCH /api/pets/[petId]/medications/[medId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { petId: string; medId: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await verifyMed(params.petId, params.medId);
    if (!existing) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

    const body = await request.json();
    const { medName, dosage, frequency, times, instructions, startDate, endDate } = body;

    const updated = await prisma.dogMedication.update({
      where: { id: params.medId },
      data: {
        ...(medName !== undefined && { medName: medName.trim() }),
        ...(dosage !== undefined && { dosage: dosage?.trim() || null }),
        ...(frequency !== undefined && { frequency: frequency?.trim() || null }),
        ...(times !== undefined && { times: times?.trim() || null }),
        ...(instructions !== undefined && { instructions: instructions?.trim() || null }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH medication error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון תרופה" }, { status: 500 });
  }
}

// DELETE /api/pets/[petId]/medications/[medId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { petId: string; medId: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await verifyMed(params.petId, params.medId);
    if (!existing) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

    await prisma.dogMedication.delete({ where: { id: params.medId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE medication error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת תרופה" }, { status: 500 });
  }
}
