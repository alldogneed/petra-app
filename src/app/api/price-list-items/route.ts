export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// Map English category IDs (used by frontend) to Hebrew (stored in DB)
const CATEGORY_ID_TO_HE: Record<string, string> = {
  training: "אילוף",
  boarding: "פנסיון",
  grooming: "טיפוח",
  products: "מוצרים",
};

// GET /api/price-list-items?category=training
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const includeInactive = searchParams.get("includeInactive") === "true";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { businessId: authResult.businessId };
    if (!includeInactive) {
      where.isActive = true;
    }
    if (category) {
      // Accept both English IDs and Hebrew labels
      where.category = CATEGORY_ID_TO_HE[category] || category;
    }

    const items = await prisma.priceListItem.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching price list items:", error);
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }
}

// POST /api/price-list-items
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:price-list-items:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();
    const { name, category, unit, basePrice, description, type, taxMode, durationMinutes, defaultQuantity, paymentUrl } = body;

    if (!name || basePrice === undefined) {
      return NextResponse.json({ error: "name and basePrice are required" }, { status: 400 });
    }

    if (Number(basePrice) < 0) {
      return NextResponse.json({ error: "basePrice must be >= 0" }, { status: 400 });
    }

    // Auto-create default PriceList if none exists
    let priceList = await prisma.priceList.findFirst({
      where: { businessId: authResult.businessId, isActive: true },
    });

    if (!priceList) {
      priceList = await prisma.priceList.create({
        data: {
          businessId: authResult.businessId,
          name: "מחירון ברירת מחדל",
          currency: "ILS",
        },
      });
    }

    const item = await prisma.priceListItem.create({
      data: {
        businessId: authResult.businessId,
        priceListId: priceList.id,
        name: name.trim(),
        category: category || null,
        unit: unit || "per_session",
        basePrice: Number(basePrice),
        description: description || null,
        type: type || "service",
        taxMode: taxMode || "inherit",
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        defaultQuantity: defaultQuantity ? Number(defaultQuantity) : 1,
        paymentUrl: paymentUrl || null,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Error creating price list item:", error);
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}
