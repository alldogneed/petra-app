import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

export async function GET() {
  try {
    const priceLists = await prisma.priceList.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(priceLists);
  } catch (error) {
    console.error("Error fetching price lists:", error);
    return NextResponse.json({ error: "Failed to fetch price lists" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, currency, isActive } = body;

    const priceList = await prisma.priceList.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
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
