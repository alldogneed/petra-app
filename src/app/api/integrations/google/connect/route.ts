export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { buildCalendarAuthUrl } from "@/lib/google-calendar";

/**
 * GET /api/integrations/google/connect?from=onboarding
 * Redirects the user to Google's OAuth consent screen for Calendar access.
 * State = "userId" or "userId|onboarding" when coming from onboarding wizard.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const from = new URL(request.url).searchParams.get("from");
    const state = from ? `${session.user.id}|${from}` : session.user.id;
    const authUrl = buildCalendarAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Error initiating Google Calendar connect:", error);
    return NextResponse.json({ error: "Failed to initiate connection" }, { status: 500 });
  }
}
