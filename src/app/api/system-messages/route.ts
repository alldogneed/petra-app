export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const where = {
      businessId: authResult.businessId,
      ...(unreadOnly ? { isRead: false } : {}),
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };

    const [messages, unreadCount] = await Promise.all([
      prisma.systemMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.systemMessage.count({
        where: { businessId: authResult.businessId, isRead: false, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      }),
    ]);

    return NextResponse.json({ messages, unreadCount });
  } catch (error) {
    console.error("System messages API error:", error);
    return NextResponse.json({ messages: [], unreadCount: 0 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    // Whitelist allowed fields to prevent mass assignment
    const message = await prisma.systemMessage.create({
      data: {
        businessId: authResult.businessId,
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
