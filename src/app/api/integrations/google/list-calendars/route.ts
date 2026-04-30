export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/google-calendar";

/**
 * GET /api/integrations/google/list-calendars
 * Returns the list of Google Calendars for the connected user.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Don't expose the impersonator's calendars during impersonation
  if (session.impersonatedBusinessId) {
    return NextResponse.json({ calendars: [], selected: [] });
  }

  const user = await prisma.platformUser.findUnique({
    where: { id: session.user.id },
    select: {
      gcalConnected: true,
      gcalRefreshToken: true,
      gcalAccessToken: true,
      gcalTokenExpiresAt: true,
      gcalSelectedCalendars: true,
    },
  });

  if (!user?.gcalConnected || !user.gcalRefreshToken) {
    return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 });
  }

  const accessToken = await getValidAccessToken(session.user.id);
  if (!accessToken) {
    return NextResponse.json({ error: "Could not get access token" }, { status: 401 });
  }

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();

  const calendars = (data.items ?? []).map((cal: {
    id: string;
    summary: string;
    backgroundColor?: string;
    primary?: boolean;
    accessRole?: string;
  }) => ({
    id: cal.id,
    summary: cal.summary,
    backgroundColor: cal.backgroundColor ?? "#4285F4",
    primary: cal.primary ?? false,
    accessRole: cal.accessRole,
  }));

  // Parse currently selected calendars
  let selected: { id: string }[] = [];
  try {
    selected = user.gcalSelectedCalendars ? JSON.parse(user.gcalSelectedCalendars) : [];
  } catch { selected = []; }

  const selectedIds = new Set(selected.map((c) => c.id));

  return NextResponse.json({ calendars, selectedIds: [...selectedIds] });
}
