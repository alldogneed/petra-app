import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const recipient = await prisma.serviceDogRecipient.findFirst({
      where: { id: params.id, businessId: DEMO_BUSINESS_ID },
      include: {
        customer: true,
        placements: {
          include: { serviceDog: { include: { pet: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!recipient) {
      return NextResponse.json({ error: "מקבל לא נמצא" }, { status: 404 });
    }

    return NextResponse.json(recipient);
  } catch (error) {
    console.error("GET /api/service-recipients/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת מקבל" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    const existing = await prisma.serviceDogRecipient.findFirst({
      where: { id: params.id, businessId: DEMO_BUSINESS_ID },
    });

    if (!existing) {
      return NextResponse.json({ error: "מקבל לא נמצא" }, { status: 404 });
    }

    const updated = await prisma.serviceDogRecipient.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.idNumber !== undefined && { idNumber: body.idNumber }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.disabilityType !== undefined && { disabilityType: body.disabilityType }),
        ...(body.disabilityNotes !== undefined && { disabilityNotes: body.disabilityNotes }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/service-recipients/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון מקבל" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.serviceDogRecipient.findFirst({
      where: { id: params.id, businessId: DEMO_BUSINESS_ID },
    });

    if (!existing) {
      return NextResponse.json({ error: "מקבל לא נמצא" }, { status: 404 });
    }

    await prisma.serviceDogRecipient.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/service-recipients/[id] error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת מקבל" }, { status: 500 });
  }
}
