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
  colorId?: string;
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

  // Title: customer name – dog name(s) – phone – address (all key info visible at a glance in calendar)
  const summaryParts = [booking.customer.name];
  if (petNames) summaryParts.push(petNames);
  summaryParts.push(booking.customer.phone);
  if (booking.customer.address) summaryParts.push(booking.customer.address);
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
 * Create a Google Calendar event for a booking in ONE user's calendar.
 * Persists the per-user id in GcalEventLink; the legacy Booking.gcalEventId
 * column is only filled if still empty (it used to be overwritten per user,
 * which made every subsequent per-user update 404 and create duplicates).
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

  const eventId = await createGcalEventOrThrow(calendarId, accessToken, payload);

  await saveEventLink("BOOKING", bookingId, userId, calendarId, eventId);

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      ...(booking.gcalEventId ? {} : { gcalEventId: eventId, gcalCalendarId: calendarId }),
      gcalSyncStatus: "synced",
      gcalLastSyncedAt: new Date(),
      gcalSyncError: null,
    },
  });

  return eventId;
}

/**
 * Update this user's copy of the booking event (per-user id via GcalEventLink,
 * legacy shared id as fallback for pre-link events).
 */
export async function updateCalendarEvent(
  userId: string,
  bookingId: string
): Promise<void> {
  const booking = await fetchBookingWithRelations(bookingId);
  const link = await getEventLink("BOOKING", bookingId, userId);
  const eventId = link?.eventId ?? booking.gcalEventId;
  const calendarId = link?.calendarId ?? booking.gcalCalendarId;

  // If no event ID for this user, create instead of update
  if (!eventId || !calendarId) {
    await createCalendarEvent(userId, bookingId);
    return;
  }

  const accessToken = await getValidAccessToken(userId);
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.petra.co.il";
  const payload = buildEventPayload(booking, appBaseUrl);

  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
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
    // 404/410 = event gone from this user's calendar — create fresh
    if (res.status === 404 || res.status === 410) {
      await createCalendarEvent(userId, bookingId);
      return;
    }
    const err = await res.text();
    throw new Error(`Failed to update Google Calendar event: ${err}`);
  }

  await saveEventLink("BOOKING", bookingId, userId, calendarId, eventId);

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
 * Delete this user's copy of the event for a cancelled/declined booking.
 */
export async function deleteCalendarEvent(
  userId: string,
  bookingId: string
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { gcalEventId: true, gcalCalendarId: true },
  });
  const link = await getEventLink("BOOKING", bookingId, userId);
  const eventId = link?.eventId ?? booking?.gcalEventId;
  const calendarId = link?.calendarId ?? booking?.gcalCalendarId;

  if (!eventId || !calendarId) {
    // Nothing to delete — mark as disabled
    if (booking) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { gcalSyncStatus: "disabled" },
      });
    }
    return;
  }

  const accessToken = await getValidAccessToken(userId);

  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
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

  if (link) {
    await prisma.gcalEventLink.delete({ where: { id: link.id } }).catch(() => undefined);
  }

  if (booking) {
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
  service: { name: string; price: number; type: string | null } | null;
  priceListItem: { name: string; basePrice: number; category: string | null } | null;
  customer: { name: string; phone: string; email: string | null; address: string | null };
  pet: { name: string } | null;
};

// Google Calendar colorId (1–11) per canonical service category, so events
// carry the same visual language in Google as in the Petra calendar.
// Keep in sync with CAL_CATEGORIES in src/app/(dashboard)/calendar/page.tsx.
function appointmentGcalColorId(
  service: { type: string | null } | null,
  priceListItem: { category: string | null } | null
): string {
  const type = service?.type ?? "";
  const cat = priceListItem?.category ?? "";
  if (type === "grooming" || cat === "טיפוח") return "4";       // תספורת – Flamingo
  if (type === "boarding" || cat === "פנסיון") return "10";     // פנסיון – Basil
  if (type === "consultation" || cat === "ייעוץ") return "1";   // ייעוץ – Lavender
  if (type === "training" || cat === "אילוף") return "9";       // אילוף בבית – Blueberry
  return "7";                                                    // פגישת לקוח – Peacock
}

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
  // Try service → priceListItem → [type] tag in notes → fallback
  const notesTag = appt.notes?.match(/^\[([^\]]+)\]/)?.[1] ?? null;
  const serviceName = appt.service?.name ?? appt.priceListItem?.name ?? notesTag ?? "תור";
  // Title: customer name – dog name – phone – address (all key info visible at a glance in calendar)
  const summaryParts = [appt.customer.name];
  if (appt.pet) summaryParts.push(appt.pet.name);
  summaryParts.push(appt.customer.phone);
  if (appt.customer.address) summaryParts.push(appt.customer.address);
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
    colorId: appointmentGcalColorId(appt.service, appt.priceListItem),
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
      service: { select: { name: true, price: true, type: true } },
      priceListItem: { select: { name: true, basePrice: true, category: true } },
      customer: { select: { name: true, phone: true, email: true, address: true } },
      pet: { select: { name: true } },
    },
  });
}

/**
 * POST a new event to a Google calendar. Throws (with the Google error body) on a
 * non-OK response or missing id, so failures surface in logs instead of silently
 * producing an undefined event id — which previously left appointments un-synced
 * with no trace (e.g. a single Friday appointment that never reached GCal).
 */
async function createGcalEventOrThrow(
  calendarId: string,
  accessToken: string,
  payload: unknown
): Promise<string> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  const data = await res.json().catch(() => ({} as { id?: string }));
  if (!res.ok || !data?.id) {
    throw new Error(`GCal event create failed (${res.status}): ${JSON.stringify(data).slice(0, 400)}`);
  }
  return data.id;
}

// ─── Per-user event links ────────────────────────────────────────────────────
// One Petra entity syncs to N connected users' calendars — each user gets their
// own Google event. Google event ids are namespaced per calendar, so the single
// shared gcalEventId column on the entity cannot address more than one user's
// copy: for every user past the first, the PUT 404'd and a fresh (duplicate)
// event was created on every edit. GcalEventLink stores the id per user.
// The legacy gcalEventId column is kept as a fallback for events synced before
// links existed — it lives in exactly one user's calendar, so the PUT succeeds
// only there and everyone else gets a link on first re-sync.

export type GcalEntityType =
  | "BOOKING"
  | "APPOINTMENT"
  | "BOARDING_STAY"
  | "TRAINING_PROGRAM_SESSION"
  | "TRAINING_GROUP_SESSION";

async function getEventLink(entityType: GcalEntityType, entityId: string, userId: string) {
  return prisma.gcalEventLink.findUnique({
    where: { entityType_entityId_userId: { entityType, entityId, userId } },
  });
}

async function saveEventLink(
  entityType: GcalEntityType,
  entityId: string,
  userId: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  await prisma.gcalEventLink.upsert({
    where: { entityType_entityId_userId: { entityType, entityId, userId } },
    create: { entityType, entityId, userId, calendarId, eventId },
    update: { calendarId, eventId },
  });
}

/**
 * Create-or-update the event copy in ONE user's calendar and persist the link.
 * Recreates only on 404/410 (event gone) — other failures throw, since blindly
 * recreating on e.g. 403 is exactly what produced duplicates before.
 * Returns the event id now present in this user's calendar.
 */
async function pushEventForUser(
  userId: string,
  entityType: GcalEntityType,
  entityId: string,
  legacyEventId: string | null,
  payload: unknown
): Promise<string> {
  const [accessToken, calendarId] = await Promise.all([
    getValidAccessToken(userId),
    ensureUserCalendar(userId),
  ]);
  const link = await getEventLink(entityType, entityId, userId);
  const knownEventId = link?.eventId ?? legacyEventId;
  const knownCalendarId = link?.calendarId ?? calendarId;

  let eventId: string | null = null;
  let eventCalendarId = calendarId;

  if (knownEventId) {
    const updateRes = await fetch(
      `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(knownCalendarId)}/events/${encodeURIComponent(knownEventId)}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (updateRes.ok) {
      eventId = knownEventId;
      eventCalendarId = knownCalendarId;
    } else if (updateRes.status !== 404 && updateRes.status !== 410) {
      const err = await updateRes.text();
      throw new Error(`GCal event update failed (${updateRes.status}): ${err.slice(0, 400)}`);
    }
  }

  if (!eventId) {
    eventId = await createGcalEventOrThrow(calendarId, accessToken, payload);
  }

  await saveEventLink(entityType, entityId, userId, eventCalendarId, eventId);
  return eventId;
}

/**
 * Sync a staff-created appointment to Google Calendar for all connected business users.
 * Fire-and-forget safe — catches per-user errors internally.
 */
export async function syncAppointmentToGcal(
  appointmentId: string,
  businessId: string
): Promise<void> {
  const appt = await fetchAppointmentForGcal(appointmentId);
  if (!appt || appt.status === "canceled") return;

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://petra-app.com";
  const payload = buildAppointmentEventPayload(appt, appBaseUrl);

  await pushEventToConnectedCalendars(
    businessId, "APPOINTMENT", appointmentId, appt.gcalEventId, payload,
    (eventId) => prisma.appointment.update({ where: { id: appointmentId }, data: { gcalEventId: eventId } }).then(() => undefined),
    "GCal appointment sync error"
  );
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
  if (!appt) return;

  await deleteEventFromConnectedCalendars(
    businessId, "APPOINTMENT", appointmentId, appt.gcalEventId,
    "GCal appointment delete error"
  );

  if (appt.gcalEventId) {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { gcalEventId: null },
    });
  }
}

/**
 * Re-sync a customer's upcoming appointments to Google Calendar. Called when the
 * customer's address (or other synced detail) changes — the gcal event embeds the
 * address, and editing the customer otherwise leaves already-synced events stale
 * (e.g. gcal showing an old city while Petra has the full updated address).
 */
export async function resyncCustomerAppointmentsToGcal(customerId: string, businessId: string): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const appts = await prisma.appointment.findMany({
    where: { customerId, businessId, date: { gte: today }, status: { not: "canceled" } },
    select: { id: true },
    take: 100,
  });
  for (const a of appts) {
    await syncAppointmentToGcal(a.id, businessId).catch((err) =>
      console.error(`resyncCustomerAppointmentsToGcal: appt ${a.id}:`, err)
    );
  }
}

// ─── Training session sync (program + group) ─────────────────────────────────
// Training sessions are a separate entity from Appointment and previously had NO
// Google Calendar integration at all — so "ליווי" sessions never reached gcal and
// failed silently (no code path ran, no error logged). These helpers fix that.

/** A full timestamp → Israel-local ISO 8601 string with the correct DST offset. */
function toIsraelIso(date: Date): string {
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
  const timeStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(date);
  return `${dateStr}T${timeStr}${getJerusalemOffset(date)}`;
}

/**
 * Create-or-update the event on every connected user's calendar, one event id
 * per user (GcalEventLink). The entity's legacy single gcalEventId column is
 * still filled after the first create so old callers/UI can tell "synced" from
 * "never synced". Per-user errors are logged, not thrown.
 */
async function pushEventToConnectedCalendars(
  businessId: string,
  entityType: GcalEntityType,
  entityId: string,
  legacyEventId: string | null,
  payload: object,
  persistLegacy: (eventId: string) => Promise<void>,
  logLabel: string
): Promise<void> {
  const syncableUsers = (await findConnectedUsersForBusiness(businessId)).filter((u) => u.gcalSyncEnabled);
  if (syncableUsers.length === 0) return;

  let storedLegacyId = legacyEventId;
  for (const user of syncableUsers) {
    try {
      const eventId = await pushEventForUser(user.id, entityType, entityId, storedLegacyId, payload);
      if (!storedLegacyId) {
        await persistLegacy(eventId);
        storedLegacyId = eventId;
      }
    } catch (err) {
      console.error(`${logLabel} (user ${user.id}):`, err);
    }
  }
}

/**
 * Delete an entity's event from every connected user's calendar (each user's
 * own copy via GcalEventLink; legacy shared id as fallback), then drop the links.
 * Deliberately not filtered by gcalSyncEnabled — a user who toggled sync off
 * should still have the stale event removed.
 */
async function deleteEventFromConnectedCalendars(
  businessId: string,
  entityType: GcalEntityType,
  entityId: string,
  legacyEventId: string | null,
  logLabel: string
): Promise<void> {
  const links = await prisma.gcalEventLink.findMany({ where: { entityType, entityId } });
  if (links.length === 0 && !legacyEventId) return;

  const linkByUser = new Map(links.map((l) => [l.userId, l] as const));
  const connectedUsers = await findConnectedUsersForBusiness(businessId);

  for (const user of connectedUsers) {
    const link = linkByUser.get(user.id);
    const eventId = link?.eventId ?? legacyEventId;
    if (!eventId) continue;
    try {
      const accessToken = await getValidAccessToken(user.id);
      const calendarId = link?.calendarId ?? (await ensureUserCalendar(user.id));
      await fetch(
        `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
      );
    } catch (err) {
      console.error(`${logLabel} (user ${user.id}):`, err);
    }
  }

  await prisma.gcalEventLink.deleteMany({ where: { entityType, entityId } });
}

/** Sync a 1-on-1 training program session ("ליווי") to Google Calendar. */
export async function syncTrainingProgramSessionToGcal(sessionId: string, businessId: string): Promise<void> {
  const s = await prisma.trainingProgramSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true, sessionDate: true, durationMinutes: true, status: true, gcalEventId: true, summary: true, trainerName: true,
      program: {
        select: {
          businessId: true, name: true, trainingType: true,
          dog: { select: { name: true } },
          customer: { select: { name: true, phone: true, address: true } },
        },
      },
    },
  });
  if (!s || s.program.businessId !== businessId || s.status === "CANCELED") return;

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://petra-app.com";
  const dogName = s.program.dog?.name ?? "כלב";
  const cust = s.program.customer;
  const summaryParts = [cust?.name ?? dogName, dogName];
  if (cust?.phone) summaryParts.push(cust.phone);
  const payload = {
    summary: `${summaryParts.join(" – ")} – אילוף`,
    description: [
      `🐕 אילוף${s.program.name ? ` – ${s.program.name}` : ""}`,
      cust?.name ? `👤 לקוח: ${cust.name}` : null,
      cust?.phone ? `📞 טלפון: ${cust.phone}` : null,
      s.trainerName ? `🧑‍🏫 מאלף: ${s.trainerName}` : null,
      ``,
      `🔗 ${appBaseUrl}/training`,
      `⚙️ מנוהל על ידי Petra`,
    ].filter(Boolean).join("\n"),
    start: { dateTime: toIsraelIso(s.sessionDate), timeZone: BOOKING_TIMEZONE },
    end: { dateTime: toIsraelIso(new Date(s.sessionDate.getTime() + s.durationMinutes * 60000)), timeZone: BOOKING_TIMEZONE },
    colorId: s.program.trainingType === "BOARDING" ? "6" : "9", // אילוף בפנסיון / אילוף בבית
    ...(cust?.address ? { location: cust.address } : {}),
    extendedProperties: { private: { petraTrainingProgramSessionId: s.id, businessId, source: "petra" } },
  };

  await pushEventToConnectedCalendars(
    businessId, "TRAINING_PROGRAM_SESSION", sessionId, s.gcalEventId, payload,
    (eventId) => prisma.trainingProgramSession.update({ where: { id: sessionId }, data: { gcalEventId: eventId } }).then(() => undefined),
    "GCal training-program session sync error"
  );
}

/** Remove a training program session from Google Calendar (on cancel/delete). */
export async function deleteTrainingProgramSessionFromGcal(sessionId: string, businessId: string): Promise<void> {
  const s = await prisma.trainingProgramSession.findUnique({
    where: { id: sessionId },
    select: { gcalEventId: true, program: { select: { businessId: true } } },
  });
  if (!s || s.program.businessId !== businessId) return;
  await deleteEventFromConnectedCalendars(businessId, "TRAINING_PROGRAM_SESSION", sessionId, s.gcalEventId, "GCal training-program session delete error");
  if (s.gcalEventId) {
    await prisma.trainingProgramSession.update({ where: { id: sessionId }, data: { gcalEventId: null } });
  }
}

/** Sync a group/workshop training session to Google Calendar. */
export async function syncTrainingGroupSessionToGcal(sessionId: string, businessId: string): Promise<void> {
  const s = await prisma.trainingGroupSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true, sessionDatetime: true, status: true, notes: true, gcalEventId: true,
      trainingGroup: { select: { businessId: true, name: true, groupType: true } },
    },
  });
  if (!s || s.trainingGroup.businessId !== businessId || s.status === "CANCELED") return;

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://petra-app.com";
  const isWorkshop = s.trainingGroup.groupType === "WORKSHOP";
  const DEFAULT_GROUP_DURATION_MIN = 60; // TrainingGroupSession has no duration field
  const payload = {
    summary: `${s.trainingGroup.name} – ${isWorkshop ? "סדנה" : "אימון קבוצתי"}`,
    description: [
      isWorkshop ? `🎓 סדנה: ${s.trainingGroup.name}` : `👥 אימון קבוצתי: ${s.trainingGroup.name}`,
      s.notes ? `📝 ${s.notes}` : null,
      ``,
      `🔗 ${appBaseUrl}/training`,
      `⚙️ מנוהל על ידי Petra`,
    ].filter(Boolean).join("\n"),
    start: { dateTime: toIsraelIso(s.sessionDatetime), timeZone: BOOKING_TIMEZONE },
    end: { dateTime: toIsraelIso(new Date(s.sessionDatetime.getTime() + DEFAULT_GROUP_DURATION_MIN * 60000)), timeZone: BOOKING_TIMEZONE },
    colorId: isWorkshop ? "11" : "3", // סדנאות / אילוף קבוצתי
    extendedProperties: { private: { petraTrainingGroupSessionId: s.id, businessId, source: "petra" } },
  };

  await pushEventToConnectedCalendars(
    businessId, "TRAINING_GROUP_SESSION", sessionId, s.gcalEventId, payload,
    (eventId) => prisma.trainingGroupSession.update({ where: { id: sessionId }, data: { gcalEventId: eventId } }).then(() => undefined),
    "GCal training-group session sync error"
  );
}

/** Remove a training group session from Google Calendar (on cancel/delete). */
export async function deleteTrainingGroupSessionFromGcal(sessionId: string, businessId: string): Promise<void> {
  const s = await prisma.trainingGroupSession.findUnique({
    where: { id: sessionId },
    select: { gcalEventId: true, trainingGroup: { select: { businessId: true } } },
  });
  if (!s || s.trainingGroup.businessId !== businessId) return;
  await deleteEventFromConnectedCalendars(businessId, "TRAINING_GROUP_SESSION", sessionId, s.gcalEventId, "GCal training-group session delete error");
  if (s.gcalEventId) {
    await prisma.trainingGroupSession.update({ where: { id: sessionId }, data: { gcalEventId: null } });
  }
}

// ─── Boarding Stay sync ──────────────────────────────────────────────────────

/**
 * Sync a boarding stay to Google Calendar for all connected business users.
 * Summary: "פנסיון – customer – phone – pet"
 * Start: checkIn, End: checkOut (or checkIn + 1 day if null)
 */
export async function syncBoardingToGcal(
  stayId: string,
  businessId: string
): Promise<void> {
  const stay = await prisma.boardingStay.findUnique({
    where: { id: stayId },
    select: {
      id: true, businessId: true, checkIn: true, checkOut: true,
      status: true, notes: true, gcalEventId: true,
      pet: { select: { name: true } },
      customer: { select: { name: true, phone: true } },
    },
  });
  if (!stay || stay.status === "cancelled") return;

  const customerName = stay.customer?.name ?? stay.pet.name;
  const customerPhone = stay.customer?.phone ?? "";
  const summaryParts = ["פנסיון", customerName];
  if (customerPhone) summaryParts.push(customerPhone);
  summaryParts.push(stay.pet.name);
  const summary = summaryParts.join(" – ");

  const startDateTime = stay.checkIn.toISOString();
  const endDate = stay.checkOut ?? new Date(stay.checkIn.getTime() + 24 * 60 * 60 * 1000);
  const endDateTime = endDate.toISOString();

  const payload = {
    summary,
    start: { dateTime: startDateTime, timeZone: BOOKING_TIMEZONE },
    end: { dateTime: endDateTime, timeZone: BOOKING_TIMEZONE },
    colorId: "10", // פנסיון – Basil
    description: [
      `🏠 פנסיון`,
      ``,
      `🐾 כלב: ${stay.pet.name}`,
      `👤 בעלים: ${customerName}`,
      customerPhone ? `📞 טלפון: ${customerPhone}` : null,
      ``,
      `📅 צ׳ק-אין: ${stay.checkIn.toLocaleDateString("he-IL")}`,
      stay.checkOut ? `📅 צ׳ק-אאוט: ${endDate.toLocaleDateString("he-IL")}` : `📅 צ׳ק-אאוט: טרם נקבע`,
      stay.notes ? `📝 הערות: ${stay.notes}` : null,
      ``,
      `⚙️ מנוהל על ידי Petra`,
    ].filter(Boolean).join("\n"),
    extendedProperties: {
      private: { petraBoardingId: stay.id, businessId, source: "petra" },
    },
  };

  await pushEventToConnectedCalendars(
    businessId, "BOARDING_STAY", stayId, stay.gcalEventId, payload,
    (eventId) => prisma.boardingStay.update({ where: { id: stayId }, data: { gcalEventId: eventId } }).then(() => undefined),
    "GCal boarding sync error"
  );
}

/**
 * Delete a boarding stay event from Google Calendar.
 */
export async function deleteBoardingFromGcal(stayId: string, businessId: string): Promise<void> {
  const stay = await prisma.boardingStay.findUnique({ where: { id: stayId }, select: { gcalEventId: true } });
  if (!stay) return;

  await deleteEventFromConnectedCalendars(businessId, "BOARDING_STAY", stayId, stay.gcalEventId, "GCal boarding delete error");

  if (stay.gcalEventId) {
    await prisma.boardingStay.update({ where: { id: stayId }, data: { gcalEventId: null } });
  }
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
      "https://www.googleapis.com/auth/contacts",
      "email",
    ].join(" "),
    state,
    access_type: "offline",
    prompt: "consent", // force refresh_token to be returned
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
