/**
 * Google Calendar Sync Service for Petra.
 * Handles OAuth token management, calendar creation/lookup, and event CRUD.
 *
 * Token encryption: AES-256-GCM via GCAL_ENCRYPTION_KEY env var (32-byte hex).
 * Timezone: Always uses Asia/Jerusalem for event times.
 */

import { prisma } from "./prisma";
import { encryptToken, decryptToken } from "./encryption";

export { encryptToken, decryptToken };

// ─── Google API endpoints ────────────────────────────────────────────────────

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const PETRA_CALENDAR_NAME = "Petra Bookings";
const BOOKING_TIMEZONE = "Asia/Jerusalem";

// ─── Token management ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Exchange authorization code for tokens (Calendar OAuth flow).
 * Returns raw tokens — caller must encrypt and store them.
 */
export async function exchangeCalendarCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  connectedEmail: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GCAL_REDIRECT_URI!;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar token exchange failed: ${err}`);
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Get the connected email from token info
  const tokenInfoRes = await fetch(
    `${GOOGLE_TOKEN_INFO_URL}?access_token=${data.access_token}`
  );
  const tokenInfo = await tokenInfoRes.json();
  const connectedEmail: string = tokenInfo.email ?? "";

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    connectedEmail,
  };
}

/**
 * Refresh access token using stored refresh token.
 * Updates the DB record automatically.
 */
export async function refreshAccessToken(userId: string): Promise<string> {
  const user = await prisma.platformUser.findUnique({
    where: { id: userId },
    select: {
      gcalRefreshToken: true,
      gcalTokenExpiresAt: true,
      gcalAccessToken: true,
    },
  });

  if (!user?.gcalRefreshToken) {
    throw new Error("No refresh token stored for user");
  }

  // Return cached token if still valid (with 5-minute buffer)
  if (
    user.gcalAccessToken &&
    user.gcalTokenExpiresAt &&
    user.gcalTokenExpiresAt > new Date(Date.now() + 5 * 60 * 1000)
  ) {
    return decryptToken(user.gcalAccessToken);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const refreshToken = decryptToken(user.gcalRefreshToken);

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = await res.json();
  const newAccessToken: string = data.access_token;
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await prisma.platformUser.update({
    where: { id: userId },
    data: {
      gcalAccessToken: encryptToken(newAccessToken),
      gcalTokenExpiresAt: expiresAt,
    },
  });

  return newAccessToken;
}

/**
 * Get a valid access token for a user (refreshes if needed).
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  return refreshAccessToken(userId);
}

// ─── Calendar management ─────────────────────────────────────────────────────

/**
 * Ensure the user has a "Petra Bookings" calendar.
 * - If gcalCalendarId is stored and accessible → return it.
 * - Else search for existing "Petra Bookings" calendar → store + return.
 * - Else create new calendar → store + return.
 * Returns calendarId.
 */
export async function ensureUserCalendar(userId: string): Promise<string> {
  const user = await prisma.platformUser.findUnique({
    where: { id: userId },
    select: { gcalCalendarId: true, gcalCalendarName: true },
  });

  if (!user) throw new Error("User not found");

  const accessToken = await getValidAccessToken(userId);
  const calName = user.gcalCalendarName ?? PETRA_CALENDAR_NAME;

  // 1. Try existing stored calendarId
  if (user.gcalCalendarId) {
    const ok = await checkCalendarExists(accessToken, user.gcalCalendarId);
    if (ok) return user.gcalCalendarId;
    // Calendar was deleted — fall through to recreate
  }

  // 2. Search calendar list for "Petra Bookings"
  const existing = await findCalendarByName(accessToken, calName);
  if (existing) {
    await prisma.platformUser.update({
      where: { id: userId },
      data: { gcalCalendarId: existing },
    });
    return existing;
  }

  // 3. Create new calendar
  const newCalId = await createCalendar(accessToken, calName);
  await prisma.platformUser.update({
    where: { id: userId },
    data: { gcalCalendarId: newCalId },
  });
  return newCalId;
}

async function checkCalendarExists(
  accessToken: string,
  calendarId: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function findCalendarByName(
  accessToken: string,
  name: string
): Promise<string | null> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/users/me/calendarList?maxResults=250`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const items: { id: string; summary: string }[] = data.items ?? [];
  const found = items.find((c) => c.summary === name);
  return found?.id ?? null;
}

async function createCalendar(
  accessToken: string,
  name: string
): Promise<string> {
  const res = await fetch(`${GOOGLE_CALENDAR_BASE}/calendars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ summary: name }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create Google Calendar: ${err}`);
  }

  const data = await res.json();
  return data.id as string;
}

// ─── Event payload builder ───────────────────────────────────────────────────

interface BookingWithRelations {
  id: string;
  businessId: string;
  startAt: Date;
  endAt: Date;
  notes: string | null;
  service: { name: string; price: number } | null;
  priceListItem: { name: string; basePrice: number } | null;
  customer: { name: string; phone: string; address: string | null; email: string | null };
  dogs: { pet: { name: string } }[];
  business?: { name: string; address: string | null };
}

interface GoogleEventPayload {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: string;
  extendedProperties: {
    private: {
      petraBookingId: string;
      businessId: string;
      source: string;
    };
  };
}

export function buildEventPayload(
  booking: BookingWithRelations,
  appBaseUrl: string
): GoogleEventPayload {
  const petNames =
    booking.dogs.length > 0
      ? booking.dogs.map((d) => d.pet.name).join(", ")
      : "";

  const serviceName = booking.service?.name ?? booking.priceListItem?.name ?? "—";
  const servicePrice = booking.service?.price ?? booking.priceListItem?.basePrice ?? 0;

  const summaryParts = [serviceName, booking.customer.name, booking.customer.phone];
  if (petNames) summaryParts.push(petNames);
  const summary = summaryParts.join(" – ");

  const location = booking.customer.address ?? booking.business?.address ?? undefined;

  const deepLink = `${appBaseUrl}/bookings/${booking.id}`;

  const description = [
    `📋 פרטי הזמנה #${booking.id.slice(0, 8)}`,
    ``,
    `👤 לקוח: ${booking.customer.name}`,
    `📞 טלפון: ${booking.customer.phone}`,
    booking.customer.email ? `📧 אימייל: ${booking.customer.email}` : null,
    ``,
    `🐾 שירות: ${serviceName}`,
    `💰 מחיר: ₪${servicePrice.toFixed(2)}`,
    petNames ? `🐶 כלבים: ${petNames}` : null,
    ``,
    booking.notes ? `📝 הערות: ${booking.notes}` : null,
    ``,
    `🔗 קישור: ${deepLink}`,
    ``,
    `⚙️ אירוע זה מנוהל על ידי Petra`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summary,
    description,
    start: {
      dateTime: booking.startAt.toISOString(),
      timeZone: BOOKING_TIMEZONE,
    },
    end: {
      dateTime: booking.endAt.toISOString(),
      timeZone: BOOKING_TIMEZONE,
    },
    ...(location ? { location } : {}),
    extendedProperties: {
      private: {
        petraBookingId: booking.id,
        businessId: booking.businessId,
        source: "petra",
      },
    },
  };
}

// ─── Event CRUD ──────────────────────────────────────────────────────────────

/**
 * Create a Google Calendar event for a booking.
 * Returns the Google event ID.
 */
export async function createCalendarEvent(
  userId: string,
  bookingId: string
): Promise<string> {
  const [accessToken, calendarId, booking] = await Promise.all([
    getValidAccessToken(userId),
    ensureUserCalendar(userId),
    fetchBookingWithRelations(bookingId),
  ]);

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.petra.co.il";
  const payload = buildEventPayload(booking, appBaseUrl);

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
    const err = await res.text();
    throw new Error(`Failed to create Google Calendar event: ${err}`);
  }

  const data = await res.json();
  const eventId: string = data.id;

  // Update booking with event ID and sync status
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      gcalEventId: eventId,
      gcalCalendarId: calendarId,
      gcalSyncStatus: "synced",
      gcalLastSyncedAt: new Date(),
      gcalSyncError: null,
    },
  });

  return eventId;
}

/**
 * Update an existing Google Calendar event for a booking.
 */
export async function updateCalendarEvent(
  userId: string,
  bookingId: string
): Promise<void> {
  const booking = await fetchBookingWithRelations(bookingId);

  // If no event ID, create instead of update
  if (!booking.gcalEventId || !booking.gcalCalendarId) {
    await createCalendarEvent(userId, bookingId);
    return;
  }

  const accessToken = await getValidAccessToken(userId);
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.petra.co.il";
  const payload = buildEventPayload(booking, appBaseUrl);

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

  if (!res.ok) {
    // If 404 (event deleted manually), create fresh
    if (res.status === 404) {
      await createCalendarEvent(userId, bookingId);
      return;
    }
    const err = await res.text();
    throw new Error(`Failed to update Google Calendar event: ${err}`);
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      gcalSyncStatus: "synced",
      gcalLastSyncedAt: new Date(),
      gcalSyncError: null,
    },
  });
}

/**
 * Delete a Google Calendar event for a cancelled/declined booking.
 */
export async function deleteCalendarEvent(
  userId: string,
  bookingId: string
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { gcalEventId: true, gcalCalendarId: true },
  });

  if (!booking?.gcalEventId || !booking.gcalCalendarId) {
    // Nothing to delete — mark as disabled
    await prisma.booking.update({
      where: { id: bookingId },
      data: { gcalSyncStatus: "disabled" },
    });
    return;
  }

  const accessToken = await getValidAccessToken(userId);

  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(booking.gcalCalendarId)}/events/${encodeURIComponent(booking.gcalEventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  // 404 = already deleted — that's fine
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Failed to delete Google Calendar event: ${err}`);
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      gcalEventId: null,
      gcalSyncStatus: "disabled",
      gcalLastSyncedAt: new Date(),
      gcalSyncError: null,
    },
  });
}

/**
 * Revoke Google Calendar access and clear stored tokens.
 */
export async function revokeCalendarAccess(userId: string): Promise<void> {
  const user = await prisma.platformUser.findUnique({
    where: { id: userId },
    select: { gcalAccessToken: true },
  });

  if (user?.gcalAccessToken) {
    try {
      const token = decryptToken(user.gcalAccessToken);
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
        { method: "POST" }
      );
    } catch {
      // Best-effort revoke — continue with DB cleanup
    }
  }

  await prisma.platformUser.update({
    where: { id: userId },
    data: {
      gcalConnected: false,
      gcalAccessToken: null,
      gcalRefreshToken: null,
      gcalTokenExpiresAt: null,
      gcalCalendarId: null,
      gcalConnectedEmail: null,
      gcalSyncEnabled: false,
    },
  });
}

// ─── Internal helpers ────────────────────────────────────────────────────────

async function fetchBookingWithRelations(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service:       { select: { name: true, price: true } },
      priceListItem: { select: { name: true, basePrice: true } },
      customer:      { select: { name: true, phone: true, address: true, email: true } },
      dogs:          { include: { pet: { select: { name: true } } } },
      business:      { select: { name: true, address: true } },
    },
  });

  if (!booking) throw new Error(`Booking ${bookingId} not found`);
  return booking;
}

/**
 * Find all business members who have Google Calendar connected.
 * Returns all connected members (owner, manager, user) so each can sync to their own calendar.
 * Also exports the legacy alias for backwards compatibility.
 */
export async function findConnectedUsersForBusiness(
  businessId: string
): Promise<{ id: string; gcalSyncEnabled: boolean }[]> {
  const memberships = await prisma.businessUser.findMany({
    where: {
      businessId,
      isActive: true,
      user: {
        gcalConnected: true,
        gcalRefreshToken: { not: null },
      },
    },
    include: {
      user: {
        select: { id: true, gcalSyncEnabled: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    id: m.user.id,
    gcalSyncEnabled: m.user.gcalSyncEnabled,
  }));
}

/**
 * Legacy alias — returns first connected owner (or any member).
 */
export async function findConnectedOwnerForBusiness(
  businessId: string
): Promise<{ id: string; gcalSyncEnabled: boolean } | null> {
  const users = await findConnectedUsersForBusiness(businessId);
  return users[0] ?? null;
}

/**
 * Fetch busy intervals from Google Calendar FreeBusy API for all connected
 * users of the business. Returns merged intervals (non-Petra events included).
 */
export async function getGcalBusyIntervals(
  businessId: string,
  startAt: Date,
  endAt: Date,
): Promise<Array<{ start: Date; end: Date }>> {
  const connectedUsers = await findConnectedUsersForBusiness(businessId)
  if (connectedUsers.length === 0) return []

  const allIntervals: Array<{ start: Date; end: Date }> = []

  for (const user of connectedUsers) {
    try {
      const accessToken = await getValidAccessToken(user.id)
      const res = await fetch(`${GOOGLE_CALENDAR_BASE}/freeBusy`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin: startAt.toISOString(),
          timeMax: endAt.toISOString(),
          items: [{ id: "primary" }],
        }),
      })

      if (!res.ok) continue

      const data = await res.json()
      const busy: Array<{ start: string; end: string }> =
        data?.calendars?.primary?.busy ?? []

      for (const b of busy) {
        allIntervals.push({ start: new Date(b.start), end: new Date(b.end) })
      }
    } catch {
      // Best-effort — skip user on error
    }
  }

  return allIntervals
}

// ─── Staff-created Appointment sync ──────────────────────────────────────────

type AppointmentForGcal = {
  id: string;
  businessId: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  gcalEventId: string | null;
  service: { name: string; price: number } | null;
  priceListItem: { name: string; basePrice: number } | null;
  customer: { name: string; phone: string; email: string | null; address: string | null };
  pet: { name: string } | null;
};

/** Returns the UTC offset string for Asia/Jerusalem on the given date, e.g. "+02:00" or "+03:00" */
function getJerusalemOffset(date: Date): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Jerusalem",
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+2";
  const match = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!match) return "+02:00";
  const sign = match[1];
  const h = String(match[2]).padStart(2, "0");
  const m = String(match[3] ?? "0").padStart(2, "0");
  return `${sign}${h}:${m}`;
}

export function buildAppointmentEventPayload(appt: AppointmentForGcal, appBaseUrl: string) {
  const serviceName = appt.service?.name ?? appt.priceListItem?.name ?? "תור";
  const summaryParts = [serviceName, appt.customer.name, appt.customer.phone];
  if (appt.pet) summaryParts.push(appt.pet.name);
  const summary = summaryParts.join(" – ");

  // Get date in Israel timezone (avoids UTC midnight date-shift bug)
  const israelDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(appt.date); // "YYYY-MM-DD"
  const offset = getJerusalemOffset(appt.date); // "+02:00" or "+03:00"
  const startDateTime = `${israelDateStr}T${appt.startTime}:00${offset}`;
  const endDateTime = `${israelDateStr}T${appt.endTime}:00${offset}`;

  const location = appt.customer.address ?? undefined;

  const deepLink = `${appBaseUrl}/calendar`;
  const description = [
    `📋 תור – ${serviceName}`,
    ``,
    `👤 לקוח: ${appt.customer.name}`,
    `📞 טלפון: ${appt.customer.phone}`,
    appt.customer.email ? `📧 אימייל: ${appt.customer.email}` : null,
    appt.pet ? `🐾 חיית מחמד: ${appt.pet.name}` : null,
    appt.notes ? `📝 הערות: ${appt.notes}` : null,
    ``,
    `🔗 קישור: ${deepLink}`,
    `⚙️ מנוהל על ידי Petra`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summary,
    description,
    start: { dateTime: startDateTime, timeZone: BOOKING_TIMEZONE },
    end: { dateTime: endDateTime, timeZone: BOOKING_TIMEZONE },
    ...(location ? { location } : {}),
    extendedProperties: {
      private: { petraAppointmentId: appt.id, businessId: appt.businessId, source: "petra" },
    },
  };
}

async function fetchAppointmentForGcal(appointmentId: string): Promise<AppointmentForGcal | null> {
  return prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true, businessId: true, date: true, startTime: true, endTime: true,
      status: true, notes: true, gcalEventId: true,
      service: { select: { name: true, price: true } },
      priceListItem: { select: { name: true, basePrice: true } },
      customer: { select: { name: true, phone: true, email: true, address: true } },
      pet: { select: { name: true } },
    },
  });
}

/**
 * Sync a staff-created appointment to Google Calendar for all connected business users.
 * Fire-and-forget safe — catches per-user errors internally.
 */
export async function syncAppointmentToGcal(
  appointmentId: string,
  businessId: string
): Promise<void> {
  const connectedUsers = await findConnectedUsersForBusiness(businessId);
  const syncableUsers = connectedUsers.filter((u) => u.gcalSyncEnabled);
  if (syncableUsers.length === 0) return;

  const appt = await fetchAppointmentForGcal(appointmentId);
  if (!appt || appt.status === "canceled") return;

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://petra-app.com";
  const payload = buildAppointmentEventPayload(appt, appBaseUrl);

  let storedEventId = appt.gcalEventId;

  for (const user of syncableUsers) {
    try {
      const [accessToken, calendarId] = await Promise.all([
        getValidAccessToken(user.id),
        ensureUserCalendar(user.id),
      ]);

      let eventId: string;

      if (storedEventId) {
        // Update existing event
        const updateRes = await fetch(
          `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${storedEventId}`,
          {
            method: "PUT",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (updateRes.ok) {
          eventId = storedEventId;
        } else {
          // Event was deleted from GCal — recreate
          const createRes = await fetch(
            `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          );
          const data = await createRes.json();
          eventId = data.id;
        }
      } else {
        // Create new event
        const createRes = await fetch(
          `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        const data = await createRes.json();
        eventId = data.id;
      }

      // Persist gcalEventId after first successful sync
      if (!storedEventId && eventId) {
        await prisma.appointment.update({
          where: { id: appointmentId },
          data: { gcalEventId: eventId },
        });
        storedEventId = eventId;
      }
    } catch (err) {
      console.error(`GCal appointment sync error (user ${user.id}):`, err);
    }
  }
}

/**
 * Remove a staff-created appointment from Google Calendar.
 * Called on appointment cancel or delete.
 */
export async function deleteAppointmentFromGcal(
  appointmentId: string,
  businessId: string
): Promise<void> {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { gcalEventId: true },
  });
  if (!appt?.gcalEventId) return;

  const connectedUsers = await findConnectedUsersForBusiness(businessId);
  const syncableUsers = connectedUsers.filter((u) => u.gcalSyncEnabled);

  for (const user of syncableUsers) {
    try {
      const [accessToken, calendarId] = await Promise.all([
        getValidAccessToken(user.id),
        ensureUserCalendar(user.id),
      ]);
      await fetch(
        `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${appt.gcalEventId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
      );
    } catch (err) {
      console.error(`GCal appointment delete error (user ${user.id}):`, err);
    }
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { gcalEventId: null },
  });
}

/**
 * Build the Google OAuth URL for Calendar scope (separate from auth login).
 */
export function buildCalendarAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = process.env.GCAL_REDIRECT_URI!;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
      "https://www.googleapis.com/auth/calendar",
      "email",
    ].join(" "),
    state,
    access_type: "offline",
    prompt: "consent", // force refresh_token to be returned
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
