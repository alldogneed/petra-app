export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/google-calendar";

interface GcalEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  colorId?: string;
  htmlLink?: string;
}

/**
 * GET /api/integrations/google/external-events?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Fetches events from the user's selected Google Calendars.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  const user = await prisma.platformUser.findUnique({
    where: { id: session.user.id },
    select: { gcalConnected: true, gcalRefreshToken: true, gcalSelectedCalendars: true },
  });

  if (!user?.gcalConnected || !user.gcalRefreshToken || !user.gcalSelectedCalendars) {
    return NextResponse.json({ events: [] });
  }

  let selectedCalendars: { id: string; summary: string; backgroundColor: string }[] = [];
  try {
    selectedCalendars = JSON.parse(user.gcalSelectedCalendars);
  } catch {
    return NextResponse.json({ events: [] });
  }

  if (selectedCalendars.length === 0) return NextResponse.json({ events: [] });

  const accessToken = await getValidAccessToken(session.user.id);
  if (!accessToken) return NextResponse.json({ events: [] });

  const timeMin = new Date(start + "T00:00:00").toISOString();
  const timeMax = new Date(end + "T23:59:59").toISOString();

  const allEvents: object[] = [];

  await Promise.all(
    selectedCalendars.map(async (cal) => {
      try {
        const url = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`
        );
        url.searchParams.set("timeMin", timeMin);
        url.searchParams.set("timeMax", timeMax);
        url.searchParams.set("singleEvents", "true");
        url.searchParams.set("orderBy", "startTime");
        url.searchParams.set("maxResults", "100");

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;

        const data = await res.json();
        const items: GcalEvent[] = data.items ?? [];

        for (const ev of items) {
          allEvents.push({
            id: `gcal-${cal.id}-${ev.id}`,
            title: ev.summary ?? "(ללא כותרת)",
            start: ev.start.dateTime ?? ev.start.date,
            end: ev.end.dateTime ?? ev.end.date,
            isAllDay: !ev.start.dateTime,
            calendarId: cal.id,
            calendarName: cal.summary,
            backgroundColor: cal.backgroundColor,
            htmlLink: ev.htmlLink,
          });
        }
      } catch {
        // ignore per-calendar errors
      }
    })
  );

  return NextResponse.json({ events: allEvents });
}
