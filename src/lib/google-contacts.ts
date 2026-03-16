/**
 * Google Contacts (People API) sync helper for Petra.
 * Syncs Petra leads to the business owner's Google Contacts when enabled.
 *
 * Scope required: https://www.googleapis.com/auth/contacts
 * (added to buildCalendarAuthUrl — any new/re-auth connection includes it)
 */

import { prisma } from "./prisma";
import { refreshAccessToken } from "./google-calendar";

const PEOPLE_API_BASE = "https://people.googleapis.com/v1";

// ─── Payload builder ────────────────────────────────────────────────────────

interface ContactPayload {
  names: { givenName: string; displayName: string }[];
  phoneNumbers?: { value: string; type: string }[];
  emailAddresses?: { value: string; type: string }[];
  biographies?: { value: string; contentType: string }[];
  addresses?: { city: string; type: string }[];
}

function buildPayload(lead: {
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  requestedService: string | null;
  city: string | null;
}): ContactPayload {
  const payload: ContactPayload = {
    names: [{ givenName: lead.name, displayName: lead.name }],
  };

  if (lead.phone) {
    payload.phoneNumbers = [{ value: lead.phone, type: "mobile" }];
  }
  if (lead.email) {
    payload.emailAddresses = [{ value: lead.email, type: "work" }];
  }

  const bioLines = [
    lead.requestedService ? `שירות מבוקש: ${lead.requestedService}` : null,
    lead.notes ? `הערות: ${lead.notes}` : null,
    "מקור: Petra CRM",
  ].filter(Boolean).join("\n");
  payload.biographies = [{ value: bioLines, contentType: "TEXT_PLAIN" }];

  if (lead.city) {
    payload.addresses = [{ city: lead.city, type: "home" }];
  }

  return payload;
}

// ─── Token helper ────────────────────────────────────────────────────────────

/**
 * Get a valid Google access token for the business owner.
 * Returns null if no owner has Google connected (or token refresh fails).
 */
async function getOwnerToken(businessId: string): Promise<{ userId: string; accessToken: string } | null> {
  const membership = await prisma.businessUser.findFirst({
    where: { businessId, role: "owner", isActive: true },
    include: {
      user: {
        select: { id: true, gcalConnected: true, gcalRefreshToken: true },
      },
    },
  });

  if (!membership?.user?.gcalConnected || !membership.user.gcalRefreshToken) {
    return null;
  }

  try {
    const accessToken = await refreshAccessToken(membership.user.id);
    return { userId: membership.user.id, accessToken };
  } catch {
    return null;
  }
}

// ─── Core sync functions ─────────────────────────────────────────────────────

async function createContact(payload: ContactPayload, accessToken: string, businessId: string): Promise<string | null> {
  const res = await fetch(`${PEOPLE_API_BASE}/people:createContact`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    if (res.status === 403) {
      // Insufficient scope — user must reconnect Google with contacts scope
      console.warn(`[GoogleContacts] 403 for business ${businessId} — user needs to reconnect Google with contacts scope`);
    } else {
      console.error(`[GoogleContacts] createContact failed (${res.status}):`, await res.text());
    }
    return null;
  }

  const data = await res.json();
  return (data.resourceName as string) ?? null;
}

/**
 * Create or update a single lead as a Google Contact.
 * Returns the Google resourceName (e.g. "people/c123") or null on failure.
 */
export async function upsertLeadContact(lead: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  requestedService: string | null;
  city: string | null;
  googleContactId: string | null;
  businessId: string;
}): Promise<string | null> {
  const tokenInfo = await getOwnerToken(lead.businessId);
  if (!tokenInfo) return null;

  const { accessToken } = tokenInfo;
  const payload = buildPayload(lead);

  if (lead.googleContactId) {
    // Update existing contact
    const updateFields = ["names"];
    if (payload.phoneNumbers) updateFields.push("phoneNumbers");
    if (payload.emailAddresses) updateFields.push("emailAddresses");
    if (payload.biographies) updateFields.push("biographies");
    if (payload.addresses) updateFields.push("addresses");

    const res = await fetch(
      `${PEOPLE_API_BASE}/${lead.googleContactId}:updateContact?updatePersonFields=${updateFields.join(",")}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...payload, etag: "*" }),
      }
    );

    if (res.status === 404) {
      // Contact was deleted on Google side — recreate
      return createContact(payload, accessToken, lead.businessId);
    }
    if (!res.ok) {
      console.error(`[GoogleContacts] updateContact failed (${res.status}) for lead ${lead.id}:`, await res.text());
      return null;
    }

    const data = await res.json();
    return (data.resourceName as string) ?? lead.googleContactId;
  }

  return createContact(payload, accessToken, lead.businessId);
}

/**
 * Check if Google Contacts sync is enabled for a business.
 */
export async function shouldSyncContacts(businessId: string): Promise<boolean> {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { googleContactsSync: true },
  });
  return biz?.googleContactsSync === true;
}

/**
 * Bulk-sync all leads for a business to Google Contacts.
 * Skips leads with no phone and no email.
 * Returns counts: { synced, failed, skipped }.
 */
export async function syncAllLeadsToContacts(businessId: string): Promise<{
  synced: number;
  failed: number;
  skipped: number;
}> {
  const tokenInfo = await getOwnerToken(businessId);
  if (!tokenInfo) return { synced: 0, failed: 0, skipped: 0 };

  const leads = await prisma.lead.findMany({
    where: { businessId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      notes: true,
      requestedService: true,
      city: true,
      googleContactId: true,
      businessId: true,
    },
  });

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const lead of leads) {
    if (!lead.phone && !lead.email) {
      skipped++;
      continue;
    }

    const resourceName = await upsertLeadContact(lead);
    if (resourceName) {
      if (resourceName !== lead.googleContactId) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { googleContactId: resourceName },
        });
      }
      synced++;
    } else {
      failed++;
    }
  }

  return { synced, failed, skipped };
}
