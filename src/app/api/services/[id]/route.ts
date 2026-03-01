export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;
    const body = await request.json();

    const existing = await prisma.service.findFirst({
      where: { id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.type !== undefined) data.type = body.type;
    if (body.duration !== undefined) data.duration = Number(body.duration);
    if (body.price !== undefined) data.price = Number(body.price);
    if (body.color !== undefined) data.color = body.color;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.includesVat !== undefined) data.includesVat = body.includesVat;
    if (body.isPublicBookable !== undefined) data.isPublicBookable = body.isPublicBookable;
    if (body.bookingMode !== undefined) data.bookingMode = body.bookingMode;
    if (body.paymentUrl !== undefined) data.paymentUrl = body.paymentUrl || null;
    if (body.depositRequired !== undefined) data.depositRequired = body.depositRequired;
    if (body.depositAmount !== undefined) data.depositAmount = body.depositAmount ? Number(body.depositAmount) : null;

    const service = await prisma.service.update({ where: { id }, data });

    return NextResponse.json(service);
  } catch (error) {
    console.error("Failed to update service:", error);
    return NextResponse.json(
      { error: "Failed to update service" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { id } = params;

    const existing = await prisma.service.findFirst({
      where: { id, businessId: authResult.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    await prisma.service.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete service:", error);
    return NextResponse.json(
      { error: "Failed to delete service" },
      { status: 500 }
    );
  }
}
