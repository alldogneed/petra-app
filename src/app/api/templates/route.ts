export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// GET /api/templates – list all message templates (alias for /api/messages)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel");
    const automationOnly = searchParams.get("automation");

    const where: any = { businessId: authResult.businessId };
    if (channel) where.channel = channel;

    const templates = await prisma.messageTemplate.findMany({
      where,
      include: automationOnly === "true"
        ? { automationRules: { select: { id: true, name: true, trigger: true, isActive: true } } }
        : undefined,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("GET templates error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת תבניות" }, { status: 500 });
  }
}

// POST /api/templates – create a message template
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:templates:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();
    const { name, channel, subject, body: templateBody, variables } = body;

    if (!name || !channel || !templateBody) {
      return NextResponse.json(
        { error: "name, channel, body are required" },
        { status: 400 }
      );
    }

    const template = await prisma.messageTemplate.create({
      data: {
        businessId: authResult.businessId,
        name,
        channel,
        subject: subject || null,
        body: templateBody,
        variables: variables || "[]",
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("POST template error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת תבנית" }, { status: 500 });
  }
}
