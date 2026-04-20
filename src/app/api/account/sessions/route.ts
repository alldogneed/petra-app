export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { fingerprintRequest } from "@/lib/login-alerts";

/**
 * GET /api/account/sessions — list active sessions for the current user.
 * Response includes a `currentSessionId` so the UI can flag the row representing
 * the device making the request.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const sessions = await prisma.adminSession.findMany({
    where: { userId: session.user.id, expiresAt: { gt: now } },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
      rememberMe: true,
    },
  });

  // Enrich with parsed device info so the client doesn't have to re-parse UA
  const enriched = sessions.map((s) => {
    const fp = fingerprintRequest(
      new Request("https://x/", { headers: { "user-agent": s.userAgent || "" } })
    );
    return {
      id: s.id,
      browser: fp.browser,
      os: fp.os,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      expiresAt: s.expiresAt,
      rememberMe: s.rememberMe,
      isCurrent: s.id === session.sessionId,
    };
  });

  return NextResponse.json({
    sessions: enriched,
    currentSessionId: session.sessionId,
  });
}
