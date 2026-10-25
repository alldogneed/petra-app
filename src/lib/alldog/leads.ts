/**
 * AllDog automations → Petra leads. A thin layer over the existing services
 * (createLead / updateLead / createTask in src/services/clients.ts — the same
 * functions behind the MCP create_lead / update_lead / create_task tools).
 * No lead logic of its own: it only decides WHICH existing call to make.
 *
 * Rules shared by the PayCall summaries, PayCall missed calls and the WhatsApp bot:
 *   - one ACTIVE lead per phone, matched on the normalized number (`resolveLeadForContact`):
 *     open stage + touched in the last 60 days (or a follow-up still ahead) → keep adding to it;
 *   - every lead of the phone closed (won / lost) or stale > 60 days → a NEW lead with a note
 *     "פונה חוזר – ליד קודם: <קישור>" (+ "לקוח קיים: <קישור>") — Or, item 24;
 *   - new leads land in the "ליד חדש" stage;
 *   - existing leads: only EMPTY fields are filled, filled fields are never overwritten — except the
 *     WhatsApp bot (`refresh`, item 30c): the latest conversation's name / city / dog replace them.
 */
import prisma from "@/lib/prisma";
import { createLead, updateLead, createTask, findCustomersByPhone } from "@/services/clients";
import { normalizeIsraeliPhone } from "@/lib/paycall";
import { formatPetNotesBlock, hasPetNotesBlock, mergePetDetails, parsePetNotesBlock, replacePetNotesBlock, type LeadPetDetails } from "@/lib/lead-pet-notes";
import type { LeadAttribution } from "@/lib/lead-attribution";
import { hasCallIdToken } from "@/lib/paycall-customer";
export { hasCallIdToken };
import { readEnv } from "@/lib/read-env";

/** Placeholder names given to auto-created leads — replaced once a real name is known. */
const PLACEHOLDER_NAME_RE = /^(שיחה מ-|וואטסאפ |ליד מוואטסאפ)/;
/** Generic names a person or an import left (Or, item 24: replaced by the name the customer gave). */
const GENERIC_NAME_RE = /^(ליד|ליד חדש|לקוח|לקוחה|לקוח חדש|ללא שם|אין שם|לא ידוע|לא צוין|פונה|פניה|פנייה|וואטסאפ|whatsapp|unknown|no name|-+|\?+)$/iu;

export function isPlaceholderLeadName(name: string | null | undefined): boolean {
  const n = name?.trim() ?? "";
  if (n.length < 2) return true;
  if (PLACEHOLDER_NAME_RE.test(n) || GENERIC_NAME_RE.test(n)) return true;
  return /^[\d\s+\-()]+$/.test(n); // just a phone number
}

export function appUrl(): string {
  return (process.env.APP_URL || "https://petra-app.com").replace(/\/$/, "");
}

/** A lead with no contact for this long is "old" — a new contact opens a new lead. */
export const STALE_LEAD_DAYS = 60;

/** Open stage AND (touched in the last 60 days OR a follow-up still ahead). Pure — tested. */
export function isActiveLead(
  lead: { closed: boolean; lastContactedAt: Date | null; createdAt: Date; nextFollowUpAt?: Date | null },
  now: Date = new Date()
): boolean {
  if (lead.closed) return false;
  if (lead.nextFollowUpAt && lead.nextFollowUpAt.getTime() >= now.getTime()) return true;
  const touch = Math.max(lead.createdAt.getTime(), lead.lastContactedAt?.getTime() ?? 0);
  return now.getTime() - touch <= STALE_LEAD_DAYS * 24 * 60 * 60 * 1000;
}

/** "פונה חוזר – ליד קודם: <קישור>" (+ "לקוח קיים: <קישור>") — the note on a returning caller's new lead. */
export function returningContactNote(previousLeadId: string | null, customerId: string | null): string | null {
  const lines = [
    previousLeadId ? `פונה חוזר – ליד קודם: ${appUrl()}/leads?lead=${previousLeadId}` : null,
    customerId ? `לקוח קיים: ${appUrl()}/customers/${customerId}` : null,
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}

/** "0501234567" — same normalization as the PayCall missed-call leads. */
export function localPhone(raw: string): string {
  return normalizeIsraeliPhone(raw);
}

/** Every lead of this business with this phone, newest first. */
export async function findLeadsByPhone(businessId: string, rawPhone: string) {
  const target = localPhone(rawPhone);
  if (target.length < 9) return [];
  // Narrow server-side on the last 4 digits (stored formats vary: "050-1234567",
  // "+972…"), then compare the normalized number.
  const candidates = await prisma.lead.findMany({
    where: { businessId, phone: { endsWith: target.slice(-4) } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return candidates.filter((l) => l.phone && localPhone(l.phone) === target);
}

/**
 * The lead a new contact from this phone belongs to:
 *   active   = the newest open lead touched in the last 60 days (keep adding to it), or null;
 *   previous = when there is no active one, the newest lead of the phone (closed or stale), or null.
 */
export async function resolveLeadForContact(businessId: string, rawPhone: string, now: Date = new Date()) {
  const leads = await findLeadsByPhone(businessId, rawPhone);
  if (!leads.length) return { active: null, previous: null };
  const stageIds = Array.from(new Set(leads.map((l) => l.stage)));
  const closedStages = new Set(
    // By id only: old leads point at stages of another business (Or's lead 5a7f… sat in a "נסגר"
    // stage owned by a different business, so it looked open and got a returning contact — item 27g).
    (await prisma.leadStage.findMany({
      where: { id: { in: stageIds }, OR: [{ isWon: true }, { isLost: true }] },
      select: { id: true },
    })).map((s) => s.id)
  );
  const active = leads.find((l) => isActiveLead({ ...l, closed: closedStages.has(l.stage) }, now)) ?? null;
  return { active, previous: active ? null : leads[0] };
}

/** The ACTIVE lead for this phone (see resolveLeadForContact), or null. */
export async function findLeadByPhone(businessId: string, rawPhone: string) {
  return (await resolveLeadForContact(businessId, rawPhone)).active;
}

/** The business's "ליד חדש" stage (PAYCALL_NEW_LEAD_STAGE_ID wins when set; else createLead's default first stage). */
async function newLeadStageId(businessId: string): Promise<string | undefined> {
  const envStage = readEnv("PAYCALL_NEW_LEAD_STAGE_ID");
  if (envStage) {
    const ok = await prisma.leadStage.findFirst({ where: { id: envStage, businessId }, select: { id: true } });
    if (ok) return ok.id;
  }
  const byName = await prisma.leadStage.findFirst({
    where: { businessId, name: "ליד חדש", isWon: false, isLost: false },
    select: { id: true },
  });
  return byName?.id; // undefined → createLead uses the first open stage
}

export interface LeadContactInput {
  businessId: string;
  phone: string;
  /** Real name if known; otherwise a placeholder is used on creation. */
  name?: string | null;
  placeholderName: string;
  source: string;
  city?: string | null;
  requestedService?: string | null;
  pet?: LeadPetDetails | null;
  /** Extra line appended to the notes of a NEW lead only. */
  creationNote?: string | null;
  attribution?: LeadAttribution | null;
  contactedAt?: Date;
  /**
   * AllDog bot (item 30c): the latest conversation wins — a name / city / dog details given now
   * replace the lead's (the earlier conversations stay in the journal). Default: fill empty fields only.
   */
  refresh?: boolean;
}

/**
 * Find the lead for this phone or create it. On an existing lead, fill only what is empty.
 * Returns the lead id and whether it was created.
 */
export async function upsertLeadFromContact(input: LeadContactInput): Promise<{ leadId: string; created: boolean }> {
  const { businessId } = input;
  const phone = localPhone(input.phone);
  const petBlock = input.pet ? formatPetNotesBlock(input.pet) : "";
  const realName = input.name?.trim() && input.name.trim().length >= 2 ? input.name.trim().slice(0, 100) : null;
  const { active: existing, previous } = await resolveLeadForContact(businessId, phone);

  if (!existing) {
    // A returning caller (old / closed lead, or already a customer) gets a NEW lead, linked in a note.
    const customer = previous?.customerId
      ? { id: previous.customerId }
      : (await findCustomersByPhone(businessId, prisma, phone).catch(() => []))[0] ?? null;
    const returning = returningContactNote(previous?.id ?? null, customer?.id ?? null);
    const notes = [input.creationNote?.trim(), returning, petBlock].filter(Boolean).join("\n\n") || null;
    const { lead } = await createLead(businessId, prisma, {
      name: realName ?? input.placeholderName,
      phone,
      source: input.source,
      stage: await newLeadStageId(businessId),
      city: input.city?.trim() || null,
      requestedService: input.requestedService?.trim() || null,
      notes,
      attribution: input.attribution ?? null,
    });
    if (input.contactedAt) {
      await updateLead(businessId, prisma, lead.id, { lastContactedAt: input.contactedAt.toISOString() });
    }
    return { leadId: lead.id, created: true };
  }

  const patch: Parameters<typeof updateLead>[3] = {};
  const refresh = !!input.refresh;
  if (realName && (isPlaceholderLeadName(existing.name) || (refresh && realName !== existing.name))) patch.name = realName;
  const city = input.city?.trim().slice(0, 200);
  if (city && (!existing.city || (refresh && city !== existing.city))) patch.city = city;
  const service = input.requestedService?.trim().slice(0, 500);
  if (service && (!existing.requestedService || (refresh && service !== existing.requestedService))) patch.requestedService = service;
  if (petBlock && refresh && input.pet) {
    // The newest dog details replace the block (another dog → a fresh block).
    const block = formatPetNotesBlock(mergePetDetails(parsePetNotesBlock(existing.notes), input.pet));
    const merged = replacePetNotesBlock(existing.notes, block);
    if (block && merged !== (existing.notes ?? "").trim() && merged.length <= 5000) patch.notes = merged;
  } else if (petBlock && !hasPetNotesBlock(existing.notes)) {
    const merged = [existing.notes?.trim(), petBlock].filter(Boolean).join("\n\n");
    if (merged.length <= 5000) patch.notes = merged;
  }
  if (input.contactedAt) patch.lastContactedAt = input.contactedAt.toISOString();
  if (Object.keys(patch).length) await updateLead(businessId, prisma, existing.id, patch);

  // Attribution columns are not part of UpdateLeadInput — fill them only while empty
  // (a missed-call lead created earlier gets the gclid/campaign of the answered call).
  const a = input.attribution;
  if (a && !existing.gclid && !existing.campaign && !existing.landingPage && (a.gclid || a.campaign || a.landingPage || (a.trafficSource !== "unknown" && existing.trafficSource === "unknown"))) {
    await prisma.lead.updateMany({
      where: { id: existing.id, businessId },
      data: {
        gclid: a.gclid, campaign: a.campaign, landingPage: a.landingPage, medium: a.medium, pageType: a.pageType,
        ...(existing.trafficSource === "unknown" ? { trafficSource: a.trafficSource } : {}),
      },
    });
  }
  return { leadId: existing.id, created: false };
}

/** Journal line on the lead (type "call"), like the PayCall missed-call logs. */
export async function addLeadCallLog(leadId: string, summary: string, treatment = "") {
  return prisma.callLog.create({
    data: { leadId, type: "call", summary: summary.slice(0, 10000), treatment: treatment.slice(0, 5000) },
  });
}

/** The CallLog of this PayCall call in the business (exact call_id match), or null. */
export async function findCallLogForCall(
  businessId: string,
  callId: string
): Promise<{ id: string; leadId: string; summary: string } | null> {
  const rows = await prisma.callLog.findMany({
    where: { summary: { contains: `call_id:${callId}` }, lead: { businessId } },
    select: { id: true, leadId: true, summary: true },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  return rows.find((r) => hasCallIdToken(r.summary, callId)) ?? null;
}

/** Replace the text of an existing journal line (pending summary → real summary). */
export async function updateLeadCallLog(id: string, leadId: string, summary: string, treatment = "") {
  await prisma.callLog.updateMany({
    where: { id, leadId },
    data: { summary: summary.slice(0, 10000), treatment: treatment.slice(0, 5000) },
  });
}

/** True when a call log with this exact PayCall id already exists in the business (idempotency). */
export async function callIdAlreadyLogged(businessId: string, callId: string): Promise<boolean> {
  const rows = await prisma.callLog.findMany({
    where: { summary: { contains: `call_id:${callId}` }, lead: { businessId } },
    select: { summary: true },
    take: 5,
  });
  return rows.some((r) => hasCallIdToken(r.summary, callId));
}


/** Next follow-up through the existing mechanism (updateLead also creates the linked LEADS task). */
export async function setLeadFollowUp(businessId: string, leadId: string, at: Date) {
  return updateLead(businessId, prisma, leadId, { nextFollowUpAt: at.toISOString(), followUpStatus: "pending" });
}

export async function createLeadTask(
  businessId: string,
  leadId: string,
  t: { title: string; description?: string; priority: "MEDIUM" | "HIGH" | "URGENT"; dueAt?: Date; dueDate?: string }
) {
  return createTask(businessId, prisma, {
    title: t.title,
    description: t.description,
    category: "LEADS",
    priority: t.priority,
    // dueDate (YYYY-MM-DD) = a day without an hour — the bot never promises a time.
    ...(t.dueDate ? { dueDate: t.dueDate } : { dueAt: (t.dueAt ?? new Date()).toISOString() }),
    relatedEntityType: "LEAD",
    relatedEntityId: leadId,
  });
}
