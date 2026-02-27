export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { DEMO_BUSINESS_ID } from "@/lib/utils";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const messages = await prisma.systemMessage.findMany({
      where: {
        businessId: DEMO_BUSINESS_ID,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("System messages API error:", error);
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    // Whitelist allowed fields to prevent mass assignment
    const message = await prisma.systemMessage.create({
      data: {
        businessId: DEMO_BUSINESS_ID,
        title: body.title,
        content: body.content,
        type: body.type || "info",
        icon: body.icon || null,
        actionUrl: body.actionUrl || null,
        actionLabel: body.actionLabel || null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("Create message error:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}
