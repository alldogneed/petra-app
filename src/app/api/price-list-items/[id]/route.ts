export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// PATCH /api/price-list-items/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.priceListItem.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.category !== undefined) data.category = body.category || null;
    if (body.basePrice !== undefined) data.basePrice = Number(body.basePrice);
    if (body.description !== undefined) data.description = body.description || null;
    if (body.unit !== undefined) data.unit = body.unit;
    if (body.durationMinutes !== undefined)
      data.durationMinutes = body.durationMinutes ? Number(body.durationMinutes) : null;
    if (body.defaultQuantity !== undefined) data.defaultQuantity = Number(body.defaultQuantity);
    if (body.taxMode !== undefined) data.taxMode = body.taxMode;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);
    if (body.paymentUrl !== undefined) data.paymentUrl = body.paymentUrl || null;
    if (body.isBookableOnline !== undefined) data.isBookableOnline = Boolean(body.isBookableOnline);
    if (body.depositRequired !== undefined) data.depositRequired = Boolean(body.depositRequired);
    if (body.depositAmount !== undefined) data.depositAmount = body.depositAmount ? Number(body.depositAmount) : null;
    if (body.maxBookingsPerDay !== undefined) data.maxBookingsPerDay = body.maxBookingsPerDay ? Number(body.maxBookingsPerDay) : null;

    const item = await prisma.priceListItem.update({
      where: { id: params.id, businessId: authResult.businessId },
      data,
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error updating price list item:", error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

// DELETE /api/price-list-items/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const existing = await prisma.priceListItem.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await prisma.priceListItem.deleteMany({ where: { id: params.id, businessId: authResult.businessId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting price list item:", error);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
