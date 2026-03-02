export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const priceLists = await prisma.priceList.findMany({
      where: { businessId: authResult.businessId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
    });
    return NextResponse.json(priceLists);
  } catch (error) {
    console.error("Error fetching price lists:", error);
    return NextResponse.json({ error: "Failed to fetch price lists" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { name, currency, isActive } = body;

    const priceList = await prisma.priceList.create({
      data: {
        businessId: authResult.businessId,
        name: name || "מחירון ברירת מחדל",
        currency: currency || "ILS",
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(priceList, { status: 201 });
  } catch (error) {
    console.error("Error creating price list:", error);
    return NextResponse.json({ error: "Failed to create price list" }, { status: 500 });
  }
}
