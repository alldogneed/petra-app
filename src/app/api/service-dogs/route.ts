export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { listServiceDogs, createServiceDog, ServiceError } from "@/services/service-dogs";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const phase = searchParams.get("phase");
    const trainingStatus = searchParams.get("trainingStatus");
    const location = searchParams.get("location");

    let result;
    try {
      result = await listServiceDogs(authResult.businessId, prisma, { phase, trainingStatus, location });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "VALIDATION") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/service-dogs error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת כלבי שירות" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:service-dogs:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();

    let profile;
    try {
      profile = await createServiceDog(authResult.businessId, prisma, body);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "VALIDATION") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
      if (e instanceof ServiceError && e.code === "CONFLICT") {
        return NextResponse.json({ error: e.message }, { status: 409 });
      }
      throw e;
    }

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error("POST /api/service-dogs error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת פרופיל כלב שירות" }, { status: 500 });
  }
}
