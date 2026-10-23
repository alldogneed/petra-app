/**
 * AllDog automations → Petra leads. A thin layer over the existing services
 * (createLead / updateLead / createTask in src/services/clients.ts — the same
 * functions behind the MCP create_lead / update_lead / create_task tools).
 * No lead logic of its own: it only decides WHICH existing call to make.
 *
 * Rules shared by the PayCall summaries and the WhatsApp bot:
 *   - one lead per phone (most recent), matched on the normalized number;
 *   - new leads land in the "ליד חדש" stage;
 *   - existing leads: only EMPTY fields are filled, filled fields are never overwritten.
 */
import prisma from "@/lib/prisma";
import { createLead, updateLead, createTask } from "@/services/clients";
import { normalizeIsraeliPhone } from "@/lib/paycall";
import { formatPetNotesBlock, hasPetNotesBlock, type LeadPetDetails } from "@/lib/lead-pet-notes";
import type { LeadAttribution } from "@/lib/lead-attribution";

/** Placeholder names given to auto-created leads — replaced once a real name is known. */
const PLACEHOLDER_NAME_RE = /^(שיחה מ-|וואטסאפ |ליד מוואטסאפ)/;

export function isPlaceholderLeadName(name: string | null | undefined): boolean {
  return !name || PLACEHOLDER_NAME_RE.test(name.trim());
}

/** "0501234567" — same normalization as the PayCall missed-call leads. */
export function localPhone(raw: string): string {
  return normalizeIsraeliPhone(raw);
}

export async function findLeadByPhone(businessId: string, rawPhone: string) {
  const target = localPhone(rawPhone);
  if (target.length < 9) return null;
  // Narrow server-side on the last 4 digits (stored formats vary: "050-1234567",
  // "+972…"), then compare the normalized number.
  const candidates = await prisma.lead.findMany({
    where: { businessId, phone: { endsWith: target.slice(-4) } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return candidates.find((l) => l.phone && localPhone(l.phone) === target) ?? null;
}

/** The business's "ליד חדש" stage (PAYCALL_NEW_LEAD_STAGE_ID wins when set; else createLead's default first stage). */
async function newLeadStageId(businessId: string): Promise<string | undefined> {
  const envStage = process.env.PAYCALL_NEW_LEAD_STAGE_ID?.trim();
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
  const existing = await findLeadByPhone(businessId, phone);

  if (!existing) {
    const notes = [input.creationNote?.trim(), petBlock].filter(Boolean).join("\n\n") || null;
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
  if (realName && isPlaceholderLeadName(existing.name)) patch.name = realName;
  if (!existing.city && input.city?.trim()) patch.city = input.city.trim().slice(0, 200);
  if (!existing.requestedService && input.requestedService?.trim()) patch.requestedService = input.requestedService.trim().slice(0, 500);
  if (petBlock && !hasPetNotesBlock(existing.notes)) {
    const merged = [existing.notes?.trim(), petBlock].filter(Boolean).join("\n\n");
    if (merged.length <= 5000) patch.notes = merged;
  }
  if (input.contactedAt) patch.lastContactedAt = input.contactedAt.toISOString();
  if (Object.keys(patch).length) await updateLead(businessId, prisma, existing.id, patch);

  // Attribution columns are not part of UpdateLeadInput — fill them only while empty
  // (a missed-call lead created earlier gets the gclid/campaign of the answered call).
  const a = input.attribution;
  if (a && (a.gclid || a.campaign || a.landingPage) && !existing.gclid && !existing.campaign && !existing.landingPage) {
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

/** True when a call log with this exact PayCall id already exists in the business (idempotency). */
export async function callIdAlreadyLogged(businessId: string, callId: string): Promise<boolean> {
  const rows = await prisma.callLog.findMany({
    where: { summary: { contains: `call_id:${callId}` }, lead: { businessId } },
    select: { summary: true },
    take: 5,
  });
  return rows.some((r) => hasCallIdToken(r.summary, callId));
}

/** `call_id:12` must not match `call_id:123`. */
export function hasCallIdToken(summary: string, callId: string): boolean {
  const escaped = callId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`call_id:${escaped}(?![0-9A-Za-z])`).test(summary);
}

/** Next follow-up through the existing mechanism (updateLead also creates the linked LEADS task). */
export async function setLeadFollowUp(businessId: string, leadId: string, at: Date) {
  return updateLead(businessId, prisma, leadId, { nextFollowUpAt: at.toISOString(), followUpStatus: "pending" });
}

export async function createLeadTask(
  businessId: string,
  leadId: string,
  t: { title: string; description?: string; priority: "MEDIUM" | "HIGH" | "URGENT"; dueAt?: Date }
) {
  return createTask(businessId, prisma, {
    title: t.title,
    description: t.description,
    category: "LEADS",
    priority: t.priority,
    dueAt: (t.dueAt ?? new Date()).toISOString(),
    relatedEntityType: "LEAD",
    relatedEntityId: leadId,
  });
}
