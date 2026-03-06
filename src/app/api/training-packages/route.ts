export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const packages = await prisma.trainingPackage.findMany({
      where: {
        businessId: authResult.businessId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        _count: { select: { programs: true } },
      },
      orderBy: { createdAt: "desc" },
    });

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

    const pkg = await prisma.trainingPackage.create({
      data: {
        businessId: authResult.businessId,
        name,
        type: type || "HOME",
        sessions: parseInt(sessions),
        durationDays: durationDays ? parseInt(durationDays) : null,
        price: parseFloat(price),
        description: description || null,
      },
      include: {
        _count: { select: { programs: true } },
      },
    });

    return NextResponse.json(pkg, { status: 201 });
  } catch (error) {
    console.error("POST training-packages error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת חבילה" }, { status: 500 });
  }
}
