export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; vestId: string } }
) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    const existing = await prisma.serviceDogVest.findFirst({
      where: { id: params.vestId, serviceDogId: params.id, businessId: auth.businessId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const updated = await prisma.serviceDogVest.update({
      where: { id: params.vestId },
      data: {
        size: body.size ?? undefined,
        color: body.color ?? undefined,
        vestType: body.vestType ?? undefined,
        serialNumber: body.serialNumber ?? undefined,
        condition: body.condition ?? undefined,
        notes: body.notes ?? undefined,
        isActive: body.isActive ?? undefined,
        retiredAt: body.isActive === false ? new Date() : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("PATCH vest error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; vestId: string } }
) {
  try {
    const auth = await requireBusinessAuth(request);
    if (isGuardError(auth)) return auth;

    await prisma.serviceDogVest.deleteMany({
      where: { id: params.vestId, serviceDogId: params.id, businessId: auth.businessId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE vest error:", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
