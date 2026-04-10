export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

interface CalendarEntry {
  id: string;
  summary: string;
  backgroundColor: string;
}

/**
 * POST /api/integrations/google/selected-calendars
 * Saves the user's selected Google Calendars for overlay in Petra's calendar.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const calendars: CalendarEntry[] = body.calendars ?? [];

  await prisma.platformUser.update({
    where: { id: session.user.id },
    data: { gcalSelectedCalendars: JSON.stringify(calendars) },
  });

  return NextResponse.json({ ok: true });
}
