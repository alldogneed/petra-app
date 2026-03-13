export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  findConnectedUsersForBusiness,
  getValidAccessToken,
  ensureUserCalendar,
  buildAppointmentEventPayload,
} from "@/lib/google-calendar";

const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * GET /api/integrations/google/debug-sync
 * Returns step-by-step diagnostic for appointment GCal sync.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const businessId = session.memberships.find((m) => m.isActive)?.businessId;
    if (!businessId) return NextResponse.json({ error: "No business" }, { status: 403 });

    const out: Record<string, unknown> = { businessId };

    // Step 1: User GCal fields
    const user = await prisma.platformUser.findUnique({
      where: { id: session.user.id },
      select: {
        id: true, gcalConnected: true, gcalSyncEnabled: true,
        gcalConnectedEmail: true, gcalCalendarId: true,
        gcalTokenExpiresAt: true, gcalRefreshToken: true,
      },
    });
    out.step1_user = {
      gcalConnected: user?.gcalConnected,
      gcalSyncEnabled: user?.gcalSyncEnabled,
      gcalConnectedEmail: user?.gcalConnectedEmail,
      gcalCalendarId: user?.gcalCalendarId,
      hasRefreshToken: !!user?.gcalRefreshToken,
      tokenExpiresAt: user?.gcalTokenExpiresAt,
    };

    // Step 2: BusinessUser
    const bu = await prisma.businessUser.findFirst({
      where: { businessId, userId: session.user.id, isActive: true },
    });
    out.step2_businessUser = bu ? { role: bu.role, isActive: bu.isActive } : null;

    // Step 3: findConnectedUsersForBusiness
    const connected = await findConnectedUsersForBusiness(businessId);
    out.step3_connectedUsers = connected;
    const syncable = connected.filter((u) => u.gcalSyncEnabled);
    out.step3_syncableUsers = syncable;
    if (syncable.length === 0) {
      out.diagnosis = "No syncable users found — sync will silently skip";
      return NextResponse.json(out);
    }

    // Step 4: Access token
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(syncable[0].id);
      out.step4_tokenOk = true;
    } catch (e) {
      out.step4_tokenError = String(e);
      return NextResponse.json(out);
    }

    // Step 5: Calendar
    let calendarId: string;
    try {
      calendarId = await ensureUserCalendar(syncable[0].id);
      out.step5_calendarId = calendarId;
    } catch (e) {
      out.step5_calendarError = String(e);
      return NextResponse.json(out);
    }

    // Step 6: Last appointment
    const appt = await prisma.appointment.findFirst({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, businessId: true, date: true, startTime: true, endTime: true,
        status: true, notes: true, gcalEventId: true,
        service: { select: { name: true, price: true } },
        priceListItem: { select: { name: true, basePrice: true } },
        customer: { select: { name: true, phone: true, email: true, address: true } },
        pet: { select: { name: true } },
      },
    });
    if (!appt) {
      out.step6_appointment = null;
      out.diagnosis = "No appointments found in DB";
      return NextResponse.json(out);
    }
    out.step6_appointment = {
      id: appt.id, status: appt.status, date: appt.date,
      startTime: appt.startTime, gcalEventId: appt.gcalEventId,
      service: appt.service?.name ?? appt.priceListItem?.name,
      customer: appt.customer.name,
    };

    // Step 7: Build payload + test API call
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://petra-app.com";
    const payload = buildAppointmentEventPayload(appt, appBaseUrl);
    out.step7_payload = payload;

    const createRes = await fetch(
      `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const createBody = await createRes.json();
    if (createRes.ok) {
      out.step7_gcalEventCreated = createBody.id;
      out.diagnosis = "SUCCESS — event created in Google Calendar";
      // Clean up
      await fetch(
        `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${createBody.id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
      );
      out.step7_testEventDeleted = true;
    } else {
      out.step7_gcalError = createBody;
      out.diagnosis = `FAILED at step 7 — Google Calendar API rejected the event`;
    }

    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
