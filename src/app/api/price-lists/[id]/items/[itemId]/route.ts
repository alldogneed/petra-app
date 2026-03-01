export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/price-lists/[id]/items/[itemId]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const item = await prisma.priceListItem.findFirst({
      where: { id: params.itemId, priceListId: params.id, businessId: authResult.businessId },
    });

    if (!item) return NextResponse.json({ error: "פריט לא נמצא" }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    console.error("GET price list item error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת פריט" }, { status: 500 });
  }
}

// PATCH /api/price-lists/[id]/items/[itemId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    // Verify ownership
    const existing = await prisma.priceListItem.findFirst({
      where: { id: params.itemId, priceListId: params.id, businessId: authResult.businessId },
    });
    if (!existing) return NextResponse.json({ error: "פריט לא נמצא" }, { status: 404 });

    const body = await request.json();

    const item = await prisma.priceListItem.update({
      where: { id: params.itemId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.basePrice !== undefined && { basePrice: body.basePrice }),
        ...(body.unit !== undefined && { unit: body.unit }),
        ...(body.taxMode !== undefined && { taxMode: body.taxMode }),
        ...(body.durationMinutes !== undefined && { durationMinutes: body.durationMinutes }),
        ...(body.defaultQuantity !== undefined && { defaultQuantity: body.defaultQuantity }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        ...(body.paymentUrl !== undefined && { paymentUrl: body.paymentUrl }),
        ...(body.isBookableOnline !== undefined && { isBookableOnline: body.isBookableOnline }),
        ...(body.depositRequired !== undefined && { depositRequired: body.depositRequired }),
        ...(body.depositAmount !== undefined && { depositAmount: body.depositAmount }),
        ...(body.type !== undefined && { type: body.type }),
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("PATCH price list item error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון פריט" }, { status: 500 });
  }
}

// DELETE /api/price-lists/[id]/items/[itemId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;

  try {
    const existing = await prisma.priceListItem.findFirst({
      where: { id: params.itemId, priceListId: params.id, businessId: authResult.businessId },
    });
    if (!existing) return NextResponse.json({ error: "פריט לא נמצא" }, { status: 404 });

    await prisma.priceListItem.delete({ where: { id: params.itemId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE price list item error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת פריט" }, { status: 500 });
  }
}
