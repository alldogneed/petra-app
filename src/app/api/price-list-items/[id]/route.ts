import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();

    const existing = await prisma.priceListItem.findFirst({
      where: { id: params.id, businessId: DEMO_BUSINESS_ID },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.basePrice !== undefined && Number(body.basePrice) < 0) {
      return NextResponse.json({ error: "basePrice must be >= 0" }, { status: 400 });
    }

    const updated = await prisma.priceListItem.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.unit !== undefined && { unit: body.unit }),
        ...(body.basePrice !== undefined && { basePrice: Number(body.basePrice) }),
        ...(body.taxMode !== undefined && { taxMode: body.taxMode }),
        ...(body.durationMinutes !== undefined && { durationMinutes: body.durationMinutes ? Number(body.durationMinutes) : null }),
        ...(body.defaultQuantity !== undefined && { defaultQuantity: Number(body.defaultQuantity) }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.sortOrder !== undefined && { sortOrder: Number(body.sortOrder) }),
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(req);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.priceListItem.findFirst({
      where: { id: params.id, businessId: DEMO_BUSINESS_ID },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Soft-delete to preserve order snapshots
    await prisma.priceListItem.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
