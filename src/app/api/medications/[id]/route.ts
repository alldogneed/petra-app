export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// Helper: verify the medication belongs to this business
async function findMedication(id: string, businessId: string) {
  return prisma.dogMedication.findFirst({
    where: {
      id,
      pet: { customer: { businessId } },
    },
  });
}

// PATCH /api/medications/[id]
// Body: { medName?, dosage?, frequency?, times?, instructions?, startDate?, endDate? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const existing = await findMedication(params.id, businessId);
    if (!existing) {
      return NextResponse.json({ error: "תרופה לא נמצאה" }, { status: 404 });
    }

    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (body.medName !== undefined) data.medName = body.medName;
    if (body.dosage !== undefined) data.dosage = body.dosage ?? null;
    if (body.frequency !== undefined) data.frequency = body.frequency ?? null;
    if (body.times !== undefined) data.times = body.times ?? null;
    if (body.instructions !== undefined)
      data.instructions = body.instructions ?? null;
    if (body.startDate !== undefined)
      data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined)
      data.endDate = body.endDate ? new Date(body.endDate) : null;

    const updated = await prisma.dogMedication.update({
      where: { id: params.id },
      data,
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            customer: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/medications/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון תרופה" }, { status: 500 });
  }
}

// DELETE /api/medications/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const existing = await findMedication(params.id, businessId);
    if (!existing) {
      return NextResponse.json({ error: "תרופה לא נמצאה" }, { status: 404 });
    }

    await prisma.dogMedication.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/medications/[id] error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת תרופה" }, { status: 500 });
  }
}
