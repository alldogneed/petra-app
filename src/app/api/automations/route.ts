export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// GET /api/automations – list automation rules
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const rules = await prisma.automationRule.findMany({
      where: { businessId: authResult.businessId },
      include: {
        template: { select: { id: true, name: true, channel: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error("GET automations error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת אוטומציות" }, { status: 500 });
  }
}

// POST /api/automations – create an automation rule
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:automations:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();
    const { name, trigger, triggerOffset, templateId, isActive } = body;

    if (!name || !trigger || !templateId) {
      return NextResponse.json(
        { error: "name, trigger, templateId are required" },
        { status: 400 }
      );
    }

    const rule = await prisma.automationRule.create({
      data: {
        businessId: authResult.businessId,
        name,
        trigger,
        triggerOffset: triggerOffset ?? 48,
        templateId,
        isActive: isActive ?? true,
      },
      include: {
        template: { select: { id: true, name: true, channel: true } },
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("POST automation error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת אוטומציה" }, { status: 500 });
  }
}
