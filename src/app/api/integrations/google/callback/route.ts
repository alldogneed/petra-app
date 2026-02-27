export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { exchangeCalendarCode, encryptToken, ensureUserCalendar } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/integrations/google/callback
 * Handles the OAuth callback from Google after Calendar consent.
 * Exchanges code for tokens, encrypts and stores them, creates "Petra Bookings" calendar.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // userId
    const error = searchParams.get("error");

    // User denied access
    if (error) {
      return NextResponse.redirect(
        new URL("/settings?gcal=denied", process.env.APP_URL || "http://localhost:3000")
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/settings?gcal=error", process.env.APP_URL || "http://localhost:3000")
      );
    }

    // Verify session matches state
    const session = await getSession();
    if (!session || session.user.id !== state) {
      return NextResponse.redirect(
        new URL("/settings?gcal=error", process.env.APP_URL || "http://localhost:3000")
      );
    }

    // Exchange code for tokens
    const { accessToken, refreshToken, expiresAt, connectedEmail } =
      await exchangeCalendarCode(code);

    // Encrypt and store tokens
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

    // Create or find "Petra Bookings" calendar
    try {
      await ensureUserCalendar(session.user.id);
    } catch (calErr) {
      console.error("Failed to create Petra calendar (will retry later):", calErr);
    }

    return NextResponse.redirect(
      new URL("/settings?gcal=connected", process.env.APP_URL || "http://localhost:3000")
    );
  } catch (error) {
    console.error("Google Calendar callback error:", error);
    return NextResponse.redirect(
      new URL("/settings?gcal=error", process.env.APP_URL || "http://localhost:3000")
    );
  }
}
