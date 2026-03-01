export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// PATCH /api/pricing/[id] – עדכון מחירון
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  try {
    const existing = await prisma.priceList.findFirst({
      where: { id: params.id, businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "מחירון לא נמצא" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const priceList = await prisma.priceList.update({
      where: { id: params.id },
      data,
      include: {
        items: {
          where: { businessId },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
    });

    return NextResponse.json(priceList);
  } catch (error) {
    console.error("PATCH /api/pricing/[id] error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון מחירון" }, { status: 500 });
  }
}

// DELETE /api/pricing/[id] – מחיקת מחירון
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  try {
    const existing = await prisma.priceList.findFirst({
      where: { id: params.id, businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "מחירון לא נמצא" }, { status: 404 });
    }

    // מחק קודם את הפריטים של המחירון
    await prisma.priceListItem.deleteMany({
      where: { priceListId: params.id, businessId },
    });

    await prisma.priceList.delete({ where: { id: params.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/pricing/[id] error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת מחירון" }, { status: 500 });
  }
}
