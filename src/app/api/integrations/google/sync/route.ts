export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { resolveSession, requireBusinessPermission, isGuardError } from "@/lib/auth-guards";
import { TENANT_PERMS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { updateCalendarEvent } from "@/lib/google-calendar";

/**
 * POST /api/integrations/google/sync
 * Syncs all upcoming non-cancelled bookings to Google Calendar.
 * Only works when the user has gcalConnected = true.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await resolveSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Block sync while impersonating — would push the impersonated business's data
    // to the impersonator's personal Google calendar.
    if (session.impersonatedBusinessId) {
      return NextResponse.json(
        { error: "Cannot sync Google Calendar while impersonating a tenant" },
        { status: 403 }
      );
    }

    // Same business resolution as every other route (owner membership first) +
    // the owner-grantable CALENDAR_SYNC permission.
    const authResult = await requireBusinessPermission(request, TENANT_PERMS.CALENDAR_SYNC);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

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
      select: { id: true },
      take: 100,
    });

    if (bookings.length === 0) {
      return NextResponse.json({ ok: true, synced: 0, message: "אין פגישות לסנכרון" });
    }

    let synced = 0;
    let failed = 0;

    for (const booking of bookings) {
      try {
        // Link-aware create-or-update of THIS user's copy of the event
        // (per-user GcalEventLink — never PUTs another member's event id)
        await updateCalendarEvent(session.user.id, booking.id);
        synced++;
      } catch {
        failed++;
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            gcalSyncStatus: "error",
            gcalSyncError: "Sync failed",
          },
        }).catch((err) => console.error("Failed to update booking sync status:", err));
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
