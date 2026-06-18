export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { exchangeCalendarCode, encryptToken, ensureUserCalendar } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

/**
 * GET /api/integrations/google/callback
 * Handles the OAuth callback from Google after Calendar consent.
 * State = "nonce|userId" or "nonce|userId|from".
 * Nonce verified against httpOnly cookie to prevent CSRF.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const rawState = searchParams.get("state") ?? "";
    const error = searchParams.get("error");

    // Parse state: "nonce|userId" or "nonce|userId|from"
    const stateParts = rawState.split("|");
    const nonce = stateParts[0];
    const userId = stateParts[1];
    const from = stateParts[2];
    const returnBase = from === "onboarding" ? "/onboarding" : "/settings";

    if (error) {
      return NextResponse.redirect(new URL(`${returnBase}?gcal=denied`, APP_URL));
    }

    if (!code || !userId || !nonce) {
      return NextResponse.redirect(new URL(`${returnBase}?gcal=error`, APP_URL));
    }

    // Verify CSRF nonce from cookie
    const storedNonce = request.cookies.get("gcal_oauth_state")?.value;
    if (!storedNonce || !timingSafeEqual(nonce, storedNonce)) {
      console.error("GCal OAuth CSRF mismatch");
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

    const response = NextResponse.redirect(new URL(`${returnBase}?gcal=connected`, APP_URL));
    // Clear the CSRF nonce cookie
    response.cookies.set("gcal_oauth_state", "", { maxAge: 0, path: "/api/integrations/google/callback" });
    return response;
  } catch (error) {
    console.error("Google Calendar callback error:", error);
    return NextResponse.redirect(new URL("/settings?gcal=error", APP_URL));
  }
}

/** Timing-safe string comparison to prevent timing attacks on nonce verification */
function timingSafeEqual(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false; // Different lengths
  }
}
