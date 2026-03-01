export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// PATCH /api/pricing/[id]/items/[itemId] – עדכון פריט
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  try {
    const existing = await prisma.priceListItem.findFirst({
      where: {
        id: params.itemId,
        priceListId: params.id,
        businessId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "פריט לא נמצא" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.unit !== undefined) data.unit = body.unit;
    if (body.unitPrice !== undefined) data.basePrice = Number(body.unitPrice);
    if (body.taxMode !== undefined) data.taxMode = body.taxMode;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);

    const item = await prisma.priceListItem.update({
      where: { id: params.itemId },
      data,
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("PATCH /api/pricing/[id]/items/[itemId] error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון פריט" }, { status: 500 });
  }
}

// DELETE /api/pricing/[id]/items/[itemId] – מחיקת פריט
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  try {
    const existing = await prisma.priceListItem.findFirst({
      where: {
        id: params.itemId,
        priceListId: params.id,
        businessId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "פריט לא נמצא" }, { status: 404 });
    }

    await prisma.priceListItem.delete({ where: { id: params.itemId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/pricing/[id]/items/[itemId] error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת פריט" }, { status: 500 });
  }
}
