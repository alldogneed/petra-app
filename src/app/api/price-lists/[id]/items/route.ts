export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      priceListId: params.id,
      businessId: DEMO_BUSINESS_ID,
    };
    if (activeOnly) where.isActive = true;

    const items = await prisma.priceListItem.findMany({
      where,
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching price list items:", error);
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const { name, basePrice } = body;

    if (!name || basePrice === undefined) {
      return NextResponse.json({ error: "name and basePrice are required" }, { status: 400 });
    }

    const item = await prisma.priceListItem.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
        priceListId: params.id,
        type: body.type || "service",
        name,
        description: body.description || null,
        category: body.category || null,
        unit: body.unit || "per_session",
        basePrice,
        taxMode: body.taxMode || "inherit",
        durationMinutes: body.durationMinutes || null,
        defaultQuantity: body.defaultQuantity ?? 1,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
        paymentUrl: body.paymentUrl || null,
        isBookableOnline: body.isBookableOnline ?? false,
        depositRequired: body.depositRequired ?? false,
        depositAmount: body.depositAmount || null,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Error creating price list item:", error);
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}
