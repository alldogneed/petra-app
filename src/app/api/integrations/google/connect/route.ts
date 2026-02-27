export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { buildCalendarAuthUrl } from "@/lib/google-calendar";

/**
 * GET /api/integrations/google/connect
 * Redirects the user to Google's OAuth consent screen for Calendar access.
 * Stores user ID in state param for callback verification.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // State = userId (will be verified in callback)
    const state = session.user.id;
    const authUrl = buildCalendarAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Error initiating Google Calendar connect:", error);
    return NextResponse.json({ error: "Failed to initiate connection" }, { status: 500 });
  }
}
