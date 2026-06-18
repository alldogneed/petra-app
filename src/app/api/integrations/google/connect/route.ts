export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { buildCalendarAuthUrl } from "@/lib/google-calendar";
import crypto from "crypto";

/**
 * GET /api/integrations/google/connect?from=onboarding
 * Redirects the user to Google's OAuth consent screen for Calendar access.
 * State = "nonce|userId|from" — nonce stored in httpOnly cookie for CSRF verification.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const from = new URL(request.url).searchParams.get("from");
    const nonce = crypto.randomBytes(16).toString("hex");
    const state = from
      ? `${nonce}|${session.user.id}|${from}`
      : `${nonce}|${session.user.id}`;
    const authUrl = buildCalendarAuthUrl(state);

    const response = NextResponse.redirect(authUrl);
    const isProd = process.env.NODE_ENV === "production";
    response.cookies.set("gcal_oauth_state", nonce, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/api/integrations/google/callback",
      maxAge: 600, // 10 minutes
    });
    return response;
  } catch (error) {
    console.error("Error initiating Google Calendar connect:", error);
    return NextResponse.json({ error: "Failed to initiate connection" }, { status: 500 });
  }
}
