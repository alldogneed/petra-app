export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const services = await prisma.service.findMany({
      where: { businessId: authResult.businessId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(services);
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:services:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();
    const {
      name, type, duration, price, color, isActive,
      description, includesVat,
      isPublicBookable, bookingMode, paymentUrl,
      depositRequired, depositAmount,
    } = body;

    if (!name || !type || !duration || price === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: name, type, duration, price" },
        { status: 400 }
      );
    }

    // Input validation
    if (typeof name !== "string" || name.length > 200) {
      return NextResponse.json({ error: "שם שירות לא תקין (מקסימום 200 תווים)" }, { status: 400 });
    }
    if (description && typeof description === "string" && description.length > 2000) {
      return NextResponse.json({ error: "תיאור ארוך מדי (מקסימום 2000 תווים)" }, { status: 400 });
    }
    const parsedDuration = Number(duration);
    const parsedPrice = Number(price);
    if (isNaN(parsedDuration) || parsedDuration < 1 || parsedDuration > 1440) {
      return NextResponse.json({ error: "משך שירות לא תקין (1-1440 דקות)" }, { status: 400 });
    }
    if (isNaN(parsedPrice) || parsedPrice < 0 || parsedPrice > 100000) {
      return NextResponse.json({ error: "מחיר לא תקין" }, { status: 400 });
    }
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return NextResponse.json({ error: "צבע לא תקין" }, { status: 400 });
    }

    const service = await prisma.service.create({
      data: {
        name,
        type,
        duration: Number(duration),
        price: Number(price),
        color: color || "#3B82F6",
        isActive: isActive !== undefined ? isActive : true,
        description: description || null,
        includesVat: includesVat ?? false,
        isPublicBookable: isPublicBookable ?? false,
        bookingMode: bookingMode || "automatic",
        paymentUrl: paymentUrl || null,
        depositRequired: depositRequired ?? false,
        depositAmount: depositAmount ? Number(depositAmount) : null,
        businessId: authResult.businessId,
      },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error("Failed to create service:", error);
    return NextResponse.json(
      { error: "Failed to create service" },
      { status: 500 }
    );
  }
}
