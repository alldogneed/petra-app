import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEMO_BUSINESS_ID } from "@/lib/utils";

// GET /api/automations – list automation rules
export async function GET() {
  try {
    const rules = await prisma.automationRule.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
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
        businessId: DEMO_BUSINESS_ID,
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
