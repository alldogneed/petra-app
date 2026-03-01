export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/pricing/[id]/items – פריטי מחירון
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  try {
    const priceList = await prisma.priceList.findFirst({
      where: { id: params.id, businessId },
    });

    if (!priceList) {
      return NextResponse.json({ error: "מחירון לא נמצא" }, { status: 404 });
    }

    const items = await prisma.priceListItem.findMany({
      where: { priceListId: params.id, businessId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/pricing/[id]/items error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת פריטים" }, { status: 500 });
  }
}

// POST /api/pricing/[id]/items – הוספת פריט למחירון
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  try {
    const priceList = await prisma.priceList.findFirst({
      where: { id: params.id, businessId },
    });

    if (!priceList) {
      return NextResponse.json({ error: "מחירון לא נמצא" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, unit, unitPrice, taxMode, isActive } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "שם הפריט הוא שדה חובה" }, { status: 400 });
    }

    if (unitPrice === undefined || unitPrice === null || isNaN(Number(unitPrice))) {
      return NextResponse.json({ error: "מחיר הפריט הוא שדה חובה" }, { status: 400 });
    }

    if (Number(unitPrice) < 0) {
      return NextResponse.json({ error: "מחיר לא יכול להיות שלילי" }, { status: 400 });
    }

    const item = await prisma.priceListItem.create({
      data: {
        businessId,
        priceListId: params.id,
        name: name.trim(),
        description: description?.trim() || null,
        unit: unit || "יח׳",
        basePrice: Number(unitPrice),
        taxMode: taxMode || "inclusive",
        isActive: isActive ?? true,
        type: "service",
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/pricing/[id]/items error:", error);
    return NextResponse.json({ error: "שגיאה בהוספת פריט" }, { status: 500 });
  }
}
