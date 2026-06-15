export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { listYards, createYard, ServiceError } from "@/services/boarding";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const yards = await listYards(authResult.businessId, prisma);
    return NextResponse.json(yards);
  } catch (error) {
    console.error("Error fetching boarding yards:", error);
    return NextResponse.json({ error: "Failed to fetch boarding yards" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:boarding-yards:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();
    const { name, capacity, type, pricePerSession } = body;
    const parsedPrice = pricePerSession != null ? Number(pricePerSession) : null;

    let yard;
    try {
      yard = await createYard(authResult.businessId, prisma, { name, capacity, type, pricePerSession: parsedPrice });
    } catch (e) {
      if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }
    return NextResponse.json(yard, { status: 201 });
  } catch (error) {
    console.error("Error creating boarding yard:", error);
    return NextResponse.json({ error: "Failed to create boarding yard" }, { status: 500 });
  }
}
