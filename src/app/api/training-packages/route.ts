export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { listTrainingPackages, createTrainingPackage } from "@/services/training";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const packages = await listTrainingPackages(authResult.businessId, prisma, { includeInactive });
    return NextResponse.json({ packages });
  } catch (error) {
    console.error("GET training-packages error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת חבילות" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:training-packages:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();
    const { name, type, sessions, durationDays, price, description } = body;

    if (!name || !sessions || price == null) {
      return NextResponse.json({ error: "שם, מספר מפגשים ומחיר הם שדות חובה" }, { status: 400 });
    }

    const parsedSessions = parseInt(sessions);
    const parsedPrice = parseFloat(price);
    if (!Number.isFinite(parsedSessions) || parsedSessions < 1) {
      return NextResponse.json({ error: "מספר מפגשים חייב להיות מספר חיובי" }, { status: 400 });
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json({ error: "מחיר לא תקין" }, { status: 400 });
    }
    if (durationDays) {
      const n = parseInt(durationDays);
      if (!Number.isFinite(n) || n < 1) {
        return NextResponse.json({ error: "משך ימים לא תקין" }, { status: 400 });
      }
    }
    if (name && typeof name === "string" && name.length > 200) {
      return NextResponse.json({ error: "שם חבילה ארוך מדי (מקסימום 200 תווים)" }, { status: 400 });
    }
    if (description && typeof description === "string" && description.length > 2000) {
      return NextResponse.json({ error: "תיאור ארוך מדי (מקסימום 2000 תווים)" }, { status: 400 });
    }

    const pkg = await createTrainingPackage(authResult.businessId, prisma, {
      name,
      type,
      sessions: parsedSessions,
      durationDays: durationDays ? parseInt(durationDays) : null,
      price: parsedPrice,
      description: description || null,
    });

    return NextResponse.json(pkg, { status: 201 });
  } catch (error) {
    console.error("POST training-packages error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת חבילה" }, { status: 500 });
  }
}
