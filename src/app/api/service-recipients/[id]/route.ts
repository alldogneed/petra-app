export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const recipient = await prisma.serviceDogRecipient.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        placements: {
          include: {
            serviceDog: {
              include: { pet: { select: { name: true, breed: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!recipient) {
      return NextResponse.json({ error: "זכאי לא נמצא" }, { status: 404 });
    }

    return NextResponse.json(recipient);
  } catch (error) {
    console.error("GET /api/service-recipients/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת זכאי" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.serviceDogRecipient.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "זכאי לא נמצא" }, { status: 404 });
    }

    const body = await request.json();

    const updated = await prisma.serviceDogRecipient.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.phone !== undefined && { phone: body.phone || null }),
        ...(body.email !== undefined && { email: body.email || null }),
        ...(body.idNumber !== undefined && { idNumber: body.idNumber || null }),
        ...(body.address !== undefined && { address: body.address || null }),
        ...(body.disabilityType !== undefined && { disabilityType: body.disabilityType || null }),
        ...(body.disabilityNotes !== undefined && { disabilityNotes: body.disabilityNotes || null }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.waitlistDate !== undefined && { waitlistDate: body.waitlistDate ? new Date(body.waitlistDate) : null }),
        ...(body.attachments !== undefined && { attachments: body.attachments }),
        ...(body.meetings !== undefined && { meetings: body.meetings }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/service-recipients/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון זכאי" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.serviceDogRecipient.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "זכאי לא נמצא" }, { status: 404 });
    }

    await prisma.serviceDogRecipient.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/service-recipients/[id] error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת זכאי" }, { status: 500 });
  }
}
