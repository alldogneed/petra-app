export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { exchangeCalendarCode, encryptToken, ensureUserCalendar } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

/**
 * GET /api/integrations/google/callback
 * Handles the OAuth callback from Google after Calendar consent.
 * State = "userId" or "userId|from" (e.g. "userId|onboarding").
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const rawState = searchParams.get("state") ?? "";
    const error = searchParams.get("error");

    // Parse state: "userId" or "userId|from"
    const [userId, from] = rawState.split("|");
    const returnBase = from === "onboarding" ? "/onboarding" : "/settings";

    if (error) {
      return NextResponse.redirect(new URL(`${returnBase}?gcal=denied`, APP_URL));
    }

    if (!code || !userId) {
      return NextResponse.redirect(new URL(`${returnBase}?gcal=error`, APP_URL));
    }

    const session = await getSession();
    if (!session || session.user.id !== userId) {
      return NextResponse.redirect(new URL(`${returnBase}?gcal=error`, APP_URL));
    }

    const { accessToken, refreshToken, expiresAt, connectedEmail } =
      await exchangeCalendarCode(code);

    await prisma.platformUser.update({
      where: { id: session.user.id },
      data: {
        gcalConnected: true,
        gcalAccessToken: encryptToken(accessToken),
        gcalRefreshToken: encryptToken(refreshToken),
        gcalTokenExpiresAt: expiresAt,
        gcalConnectedEmail: connectedEmail,
        gcalLastConnectedAt: new Date(),
        gcalSyncEnabled: true,
      },
    });

    try {
      await ensureUserCalendar(session.user.id);
    } catch (calErr) {
      console.error("Failed to create Petra calendar (will retry later):", calErr);
    }

    return NextResponse.redirect(new URL(`${returnBase}?gcal=connected`, APP_URL));
  } catch (error) {
    console.error("Google Calendar callback error:", error);
    return NextResponse.redirect(new URL("/settings?gcal=error", APP_URL));
  }
}
