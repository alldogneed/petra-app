export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { getMaxPriceItems, normalizeTier } from "@/lib/feature-flags";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      priceListId: params.id,
      businessId: authResult.businessId,
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
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Enforce price item limit for free tier
    const business = await prisma.business.findUnique({ where: { id: authResult.businessId }, select: { tier: true } });
    const maxItems = getMaxPriceItems(normalizeTier(business?.tier));
    if (maxItems !== null) {
      const currentCount = await prisma.priceListItem.count({
        where: { businessId: authResult.businessId, isActive: true },
      });
      if (currentCount >= maxItems) {
        return NextResponse.json(
          { error: `מנוי חינמי מוגבל ל-${maxItems} פריטי מחירון. שדרג לבייסיק כדי להוסיף עוד.` },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { name, basePrice } = body;

    if (!name || basePrice === undefined) {
      return NextResponse.json({ error: "name and basePrice are required" }, { status: 400 });
    }

    const item = await prisma.priceListItem.create({
      data: {
        businessId: authResult.businessId,
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
        maxBookingsPerDay: body.maxBookingsPerDay || null,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Error creating price list item:", error);
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}
