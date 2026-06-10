export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { validateSafeUrl } from "@/lib/validation";

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

    // Validate string lengths
    if (body.name !== undefined && (typeof body.name !== "string" || body.name.length > 200)) {
      return NextResponse.json({ error: "שם פריט ארוך מדי (עד 200 תווים)" }, { status: 400 });
    }
    if (body.description !== undefined && body.description !== null && (typeof body.description !== "string" || body.description.length > 2000)) {
      return NextResponse.json({ error: "תיאור ארוך מדי (עד 2000 תווים)" }, { status: 400 });
    }
    if (body.category !== undefined && body.category !== null && (typeof body.category !== "string" || body.category.length > 100)) {
      return NextResponse.json({ error: "קטגוריה לא תקינה" }, { status: 400 });
    }

    // Validate numeric bounds
    const numericFields: Array<[string, number, number]> = [
      ["basePrice", 0, 1_000_000],
      ["durationMinutes", 1, 1440],
      ["depositAmount", 0, 1_000_000],
      ["maxBookingsPerDay", 1, 1000],
      ["defaultQuantity", 1, 10000],
    ];
    for (const [field, min, max] of numericFields) {
      if (body[field] !== undefined && body[field] !== null) {
        const n = Number(body[field]);
        if (!Number.isFinite(n) || n < min || n > max) {
          return NextResponse.json({ error: `ערך לא תקין עבור ${field}` }, { status: 400 });
        }
      }
    }

    if (body.paymentUrl) {
      const urlError = validateSafeUrl(body.paymentUrl);
      if (urlError) return NextResponse.json({ error: urlError }, { status: 400 });
    }

    const item = await prisma.priceListItem.update({
      where: { id: params.itemId, businessId: authResult.businessId },
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

    await prisma.priceListItem.delete({ where: { id: params.itemId, businessId: authResult.businessId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE price list item error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת פריט" }, { status: 500 });
  }
}
