export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { revokeCalendarAccess } from "@/lib/google-calendar";

/**
 * POST /api/integrations/google/disconnect
 * Revokes Google Calendar access and clears stored tokens.
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await revokeCalendarAccess(session.user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error disconnecting Google Calendar:", error);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
