/**
 * Google Contacts (People API) sync for Petra leads.
 *
 * When `Business.googleContactsSync` is on, every lead created or edited in Petra is
 * written to the business owner's own Google Contacts. Create + update only:
 * Petra never lists or reads the owner's existing contacts — the only contact it
 * touches is the one it created itself (`Lead.googleContactId`).
 *
 * Scope: https://www.googleapis.com/auth/contacts — requested incrementally, only when
 * the owner turns the sync on (see `buildCalendarAuthUrl({ contacts: true })`).
 * The token lives in the owner's existing Google connection (PlatformUser.gcal*).
 */

import { prisma } from "./prisma";
import { refreshAccessToken } from "./google-calendar";

const PEOPLE_API_BASE = "https://people.googleapis.com/v1";
const GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo";

export const GOOGLE_CONTACTS_SCOPE = "https://www.googleapis.com/auth/contacts";

/** True when a space-separated OAuth scope string includes the contacts scope. */
export function scopeIncludesContacts(scope: string | null | undefined): boolean {
  return !!scope && scope.split(/\s+/).includes(GOOGLE_CONTACTS_SCOPE);
}

// ─── Payload builder ────────────────────────────────────────────────────────

interface ContactPayload {
  names: { givenName: string }[];
  phoneNumbers?: { value: string; type: string }[];
  emailAddresses?: { value: string; type: string }[];
  biographies?: { value: string; contentType: string }[];
  addresses?: { city: string; type: string }[];
}

export interface LeadForContact {
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  requestedService: string | null;
  city: string | null;
}

export function buildContactPayload(lead: LeadForContact): ContactPayload {
  const payload: ContactPayload = {
    names: [{ givenName: lead.name }],
  };

  if (lead.phone) payload.phoneNumbers = [{ value: lead.phone, type: "mobile" }];
  if (lead.email) payload.emailAddresses = [{ value: lead.email, type: "work" }];

  const bioLines = [
    lead.requestedService ? `שירות מבוקש: ${lead.requestedService}` : null,
    lead.notes ? `הערות: ${lead.notes}` : null,
    "מקור: Petra",
  ].filter(Boolean).join("\n");
  payload.biographies = [{ value: bioLines, contentType: "TEXT_PLAIN" }];

  if (lead.city) payload.addresses = [{ city: lead.city, type: "home" }];

  return payload;
}

// ─── Token helpers ───────────────────────────────────────────────────────────

/**
 * A Google access token of a business owner, or null when no owner has Google connected.
 * A business can have several owners and only one of them may have connected Google —
 * so we look for the connected ones, never "the first owner".
 */
async function getOwnerAccessToken(businessId: string): Promise<string | null> {
  const owners = await prisma.businessUser.findMany({
    where: {
      businessId,
      role: "owner",
      isActive: true,
      user: { gcalConnected: true, gcalRefreshToken: { not: null } },
    },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });

  for (const owner of owners) {
    try {
      return await refreshAccessToken(owner.userId);
    } catch {
      // Try the next connected owner.
    }
  }
  console.warn(`[GoogleContacts] sync is on but no owner has a usable Google connection (business ${businessId})`);
  return null;
}

/**
 * Whether the user's stored Google token carries the contacts scope.
 * Asks Google's tokeninfo endpoint (token metadata only — no contact data).
 */
export async function userHasContactsScope(userId: string): Promise<boolean> {
  try {
    const accessToken = await refreshAccessToken(userId);
    const res = await fetch(`${GOOGLE_TOKEN_INFO_URL}?access_token=${encodeURIComponent(accessToken)}`);
    if (!res.ok) return false;
    const info = (await res.json()) as { scope?: string };
    return scopeIncludesContacts(info.scope);
  } catch {
    return false;
  }
}

// ─── People API calls ────────────────────────────────────────────────────────

async function createContact(payload: ContactPayload, accessToken: string): Promise<string | null> {
  const res = await fetch(`${PEOPLE_API_BASE}/people:createContact`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error(`[GoogleContacts] createContact failed (${res.status})`);
    return null;
  }
  const data = (await res.json()) as { resourceName?: string };
  return data.resourceName ?? null;
}

/**
 * Update the contact Petra created earlier. The People API requires the contact's
 * current etag, so we fetch the metadata of that one contact first.
 * Returns "gone" when the owner deleted the contact in Google.
 */
async function updateContact(
  resourceName: string,
  payload: ContactPayload,
  accessToken: string
): Promise<string | "gone" | null> {
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  const metaRes = await fetch(`${PEOPLE_API_BASE}/${resourceName}?personFields=metadata`, { headers });
  if (metaRes.status === 404) return "gone";
  if (!metaRes.ok) {
    console.error(`[GoogleContacts] contact lookup failed (${metaRes.status})`);
    return null;
  }
  const meta = (await metaRes.json()) as { etag?: string };

  const updateFields = ["names", "biographies"];
  if (payload.phoneNumbers) updateFields.push("phoneNumbers");
  if (payload.emailAddresses) updateFields.push("emailAddresses");
  if (payload.addresses) updateFields.push("addresses");

  const res = await fetch(
    `${PEOPLE_API_BASE}/${resourceName}:updateContact?updatePersonFields=${updateFields.join(",")}`,
    { method: "PATCH", headers, body: JSON.stringify({ ...payload, etag: meta.etag }) }
  );
  if (res.status === 404) return "gone";
  if (!res.ok) {
    console.error(`[GoogleContacts] updateContact failed (${res.status})`);
    return null;
  }
  const data = (await res.json()) as { resourceName?: string };
  return data.resourceName ?? resourceName;
}

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * Create or update the Google contact of one lead. No-op unless the business turned
 * the sync on and its owner has Google connected. Never throws — callers run it as a
 * post-response side effect.
 */
export async function syncLeadToGoogleContacts(businessId: string, leadId: string): Promise<void> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { googleContactsSync: true },
    });
    if (!business?.googleContactsSync) return;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, businessId },
      select: {
        id: true, name: true, phone: true, email: true, notes: true,
        requestedService: true, city: true, googleContactId: true,
      },
    });
    // A contact with no phone and no email is useless in an address book.
    if (!lead || (!lead.phone && !lead.email)) return;

    const accessToken = await getOwnerAccessToken(businessId);
    if (!accessToken) return;

    const payload = buildContactPayload(lead);
    let resourceName: string | null = null;
    if (lead.googleContactId) {
      const updated = await updateContact(lead.googleContactId, payload, accessToken);
      resourceName = updated === "gone" ? await createContact(payload, accessToken) : updated;
    } else {
      resourceName = await createContact(payload, accessToken);
    }

    if (resourceName && resourceName !== lead.googleContactId) {
      await prisma.lead.update({ where: { id: lead.id }, data: { googleContactId: resourceName } });
    }
  } catch (err) {
    console.error("[GoogleContacts] sync failed:", err instanceof Error ? err.message : err);
  }
}

// ─── Bulk sync of existing leads ─────────────────────────────────────────────

/** Leads that were never written to Google Contacts and have something to write. */
const PENDING_LEADS_WHERE = (businessId: string) => ({
  businessId,
  googleContactId: null,
  OR: [{ phone: { not: null } }, { email: { not: null } }],
});

/** People API caps batchCreateContacts at 200; 50 keeps one request well inside the function timeout. */
const BULK_CHUNK = 50;

export async function countLeadsPendingContactSync(businessId: string): Promise<number> {
  return prisma.lead.count({ where: PENDING_LEADS_WHERE(businessId) });
}

export type BulkContactSyncResult =
  | { ok: true; synced: number; failed: number; remaining: number }
  | { ok: false; reason: "disabled" | "not_connected" | "google_error" };

/**
 * Create Google contacts for the next chunk of leads that have none yet (one People API
 * batch call). The caller repeats until `remaining` is 0. Leads that already have a
 * contact are never touched here — edits keep flowing through syncLeadToGoogleContacts.
 */
export async function syncPendingLeadsToGoogleContacts(businessId: string): Promise<BulkContactSyncResult> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { googleContactsSync: true },
  });
  if (!business?.googleContactsSync) return { ok: false, reason: "disabled" };

  const accessToken = await getOwnerAccessToken(businessId);
  if (!accessToken) return { ok: false, reason: "not_connected" };

  const leads = await prisma.lead.findMany({
    where: PENDING_LEADS_WHERE(businessId),
    select: { id: true, name: true, phone: true, email: true, notes: true, requestedService: true, city: true },
    orderBy: { createdAt: "asc" },
    take: BULK_CHUNK,
  });
  if (leads.length === 0) return { ok: true, synced: 0, failed: 0, remaining: 0 };

  const res = await fetch(`${PEOPLE_API_BASE}/people:batchCreateContacts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      contacts: leads.map((lead) => ({ contactPerson: buildContactPayload(lead) })),
      readMask: "metadata",
    }),
  });
  if (!res.ok) {
    console.error(`[GoogleContacts] batchCreateContacts failed (${res.status})`);
    return { ok: false, reason: "google_error" };
  }

  // createdPeople comes back in request order.
  const data = (await res.json()) as { createdPeople?: { person?: { resourceName?: string } }[] };
  const created = data.createdPeople ?? [];
  const updates = leads
    .map((lead, i) => ({ id: lead.id, resourceName: created[i]?.person?.resourceName }))
    .filter((u): u is { id: string; resourceName: string } => !!u.resourceName);

  for (let i = 0; i < updates.length; i += 10) {
    await Promise.all(
      updates.slice(i, i + 10).map((u) =>
        prisma.lead.update({ where: { id: u.id }, data: { googleContactId: u.resourceName } })
      )
    );
  }

  const remaining = await countLeadsPendingContactSync(businessId);
  return { ok: true, synced: updates.length, failed: leads.length - updates.length, remaining };
}
