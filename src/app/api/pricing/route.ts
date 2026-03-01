export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

// GET /api/pricing – רשימת מחירונים עם הפריטים שלהם
export async function GET(req: NextRequest) {
  const authResult = await requireBusinessAuth(req);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  try {
    const priceLists = await prisma.priceList.findMany({
      where: { businessId },
      include: {
        items: {
          where: { businessId },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(priceLists);
  } catch (error) {
    console.error("GET /api/pricing error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת מחירונים" }, { status: 500 });
  }
}

// POST /api/pricing – יצירת מחירון חדש
export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  try {
    const body = await request.json();
    const { name, currency, isActive } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "שם המחירון הוא שדה חובה" }, { status: 400 });
    }

    const priceList = await prisma.priceList.create({
      data: {
        businessId,
        name: name.trim(),
        currency: currency || "ILS",
        isActive: isActive ?? true,
      },
      include: { items: true },
    });

    return NextResponse.json(priceList, { status: 201 });
  } catch (error) {
    console.error("POST /api/pricing error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת מחירון" }, { status: 500 });
  }
}
