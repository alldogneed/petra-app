import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// GET /api/sessions – list active sessions for current user
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await prisma.adminSession.findMany({
      where: {
        userId: currentUser.id,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
      },
      orderBy: { lastSeenAt: "desc" },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("GET sessions error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת סשנים" }, { status: 500 });
  }
}

// DELETE /api/sessions – revoke a specific session (pass sessionId in body)
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    // Only allow deleting own sessions
    await prisma.adminSession.deleteMany({
      where: {
        id: sessionId,
        userId: currentUser.id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE session error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת סשן" }, { status: 500 });
  }
}
