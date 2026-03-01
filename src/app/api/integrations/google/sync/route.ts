export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken, ensureUserCalendar, buildEventPayload } from "@/lib/google-calendar";

const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * POST /api/integrations/google/sync
 * Syncs all upcoming non-cancelled bookings to Google Calendar.
 * Only works when the user has gcalConnected = true.
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const businessId = session.memberships.find((m) => m.isActive)?.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "No active business" }, { status: 403 });
    }

    const user = await prisma.platformUser.findUnique({
      where: { id: session.user.id },
      select: {
        gcalConnected: true,
        gcalRefreshToken: true,
        gcalCalendarName: true,
      },
    });

    if (!user?.gcalConnected || !user.gcalRefreshToken) {
      return NextResponse.json(
        { error: "Google Calendar לא מחובר" },
        { status: 400 }
      );
    }

    // Fetch upcoming non-cancelled bookings for this business
    const bookings = await prisma.booking.findMany({
      where: {
        businessId,
        status: { notIn: ["cancelled", "declined"] },
        startAt: { gte: new Date() },
        gcalSyncStatus: { not: "synced" },
      },
      include: {
        service: { select: { name: true, price: true } },
        customer: { select: { name: true, phone: true, address: true, email: true } },
        dogs: { include: { pet: { select: { name: true } } } },
        business: { select: { name: true, address: true } },
      },
      take: 100,
    });

    if (bookings.length === 0) {
      return NextResponse.json({ ok: true, synced: 0, message: "אין פגישות לסנכרון" });
    }

    const [accessToken, calendarId] = await Promise.all([
      getValidAccessToken(session.user.id),
      ensureUserCalendar(session.user.id),
    ]);

    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://app.petra.co.il";

    let synced = 0;
    let failed = 0;

    for (const booking of bookings) {
      try {
        const payload = buildEventPayload(booking, appBaseUrl);

        // If already has a gcalEventId, update — otherwise create
        if (booking.gcalEventId && booking.gcalCalendarId) {
          const res = await fetch(
            `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(booking.gcalCalendarId)}/events/${encodeURIComponent(booking.gcalEventId)}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            }
          );

          if (res.ok || res.status === 404) {
            if (res.status === 404) {
              // Recreate below
              await createEvent(accessToken, calendarId, booking.id, payload);
            } else {
              await prisma.booking.update({
                where: { id: booking.id },
                data: {
                  gcalSyncStatus: "synced",
                  gcalLastSyncedAt: new Date(),
                  gcalSyncError: null,
                },
              });
            }
            synced++;
          } else {
            failed++;
          }
        } else {
          await createEvent(accessToken, calendarId, booking.id, payload);
          synced++;
        }
      } catch {
        failed++;
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            gcalSyncStatus: "error",
            gcalSyncError: "Sync failed",
          },
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      ok: true,
      synced,
      failed,
      message: `סונכרנו ${synced} פגישות בהצלחה${failed > 0 ? ` (${failed} נכשלו)` : ""}`,
    });
  } catch (error) {
    console.error("Google Calendar sync error:", error);
    return NextResponse.json(
      { error: "שגיאה בסנכרון Google Calendar" },
      { status: 500 }
    );
  }
}

async function createEvent(
  accessToken: string,
  calendarId: string,
  bookingId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
) {
  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to create event: ${await res.text()}`);
  }

  const data = await res.json();
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      gcalEventId: data.id,
      gcalCalendarId: calendarId,
      gcalSyncStatus: "synced",
      gcalLastSyncedAt: new Date(),
      gcalSyncError: null,
    },
  });
}
