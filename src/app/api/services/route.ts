export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const services = await prisma.service.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
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
    const authResult = await requireAuth(request);
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
        businessId: DEMO_BUSINESS_ID,
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
