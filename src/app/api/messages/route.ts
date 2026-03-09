export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logCurrentUserActivity } from "@/lib/activity-log";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel");

    const where: any = {
      businessId: authResult.businessId,
    };

    if (channel) {
      where.channel = channel;
    }

    const templates = await prisma.messageTemplate.findMany({
      where,
      include: {
        automationRules: {
          select: { id: true, trigger: true, triggerOffset: true, isActive: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching message templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch message templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:messages:create", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json();
    const { name, channel, subject, body: templateBody, variables } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "שדה שם חובה" }, { status: 400 });
    }
    if (!templateBody || typeof templateBody !== "string" || !templateBody.trim()) {
      return NextResponse.json({ error: "שדה תוכן הודעה חובה" }, { status: 400 });
    }

    const template = await prisma.messageTemplate.create({
      data: {
        businessId: authResult.businessId,
        name,
        channel,
        subject,
        body: templateBody,
        variables: variables || "[]",
      },
    });

    logCurrentUserActivity("CREATE_MESSAGE_TEMPLATE");
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating message template:", error);
    return NextResponse.json(
      { error: "Failed to create message template" },
      { status: 500 }
    );
  }
}
