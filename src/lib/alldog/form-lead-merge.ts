/**
 * AllDog — a website form from a phone that already has an ACTIVE lead (Or, 26/11/2026).
 *
 * A caller hung up on the voice agent twice and then filled the form on the site: Petra held two
 * leads for one phone ("שיחה מ-…" from the call, "שיר כהן" from the form) and the rep deleted one by
 * hand. The form now joins the active lead, like the bot and PayCall do (resolveLeadForContact):
 * the placeholder name is replaced, empty fields and empty attribution are filled, and what the
 * form said goes into the journal. No active lead (none / closed / stale) → null, and the webhook
 * creates a new lead exactly as before. AllDog business only.
 */
import prisma from "@/lib/prisma";
import { isAllDogBusiness } from "@/lib/alldog/config";
import { addLeadCallLog, isPlaceholderLeadName, resolveLeadForContact, upsertLeadFromContact } from "@/lib/alldog/leads";
import { israelParts } from "@/lib/alldog/time";
import type { LeadAttribution } from "@/lib/lead-attribution";

export const FORM_JOURNAL_PREFIX = "[אתר · טופס]";

export interface FormLeadInput {
  businessId: string;
  phone: string | null | undefined;
  name?: string | null;
  email?: string | null;
  source: string;
  city?: string | null;
  service?: string | null;
  /** The notes the webhook would have written on a new lead (form details, UTM lines…). */
  notes?: string | null;
  attribution?: LeadAttribution | null;
}

/** "[אתר · טופס] השאיר פרטים בטופס באתר (25/11 11:02) · מקור: …" + the form's own lines. Pure — tested. */
export function formJournalText(input: Pick<FormLeadInput, "source" | "notes">, now: Date): string {
  const p = israelParts(now);
  const when = `${p.ymd.slice(8, 10)}/${p.ymd.slice(5, 7)} ${p.hhmm}`;
  return [`${FORM_JOURNAL_PREFIX} השאיר פרטים בטופס באתר (${when}) · מקור: ${input.source}`, input.notes?.trim() || null]
    .filter(Boolean)
    .join("\n")
    .slice(0, 5000);
}

/** The active lead the form was merged into, or null when a new lead should be created. Never throws. */
export async function mergeFormIntoActiveLead(
  input: FormLeadInput,
  now: Date = new Date(),
): Promise<{ id: string; name: string; stage: string; replacedPlaceholder: boolean } | null> {
  try {
    if (!isAllDogBusiness(input.businessId) || !input.phone) return null;
    const { active } = await resolveLeadForContact(input.businessId, input.phone, now);
    if (!active) return null;
    const replacedPlaceholder = isPlaceholderLeadName(active.name) && !!input.name && !isPlaceholderLeadName(input.name);
    // Name (over a placeholder only), city, service and empty attribution — the same fill-empty rules as PayCall.
    await upsertLeadFromContact({
      businessId: input.businessId, phone: input.phone, name: input.name ?? null, placeholderName: active.name,
      source: input.source, city: input.city ?? null, requestedService: input.service ?? null, attribution: input.attribution ?? null,
    });
    if (input.email) {
      await prisma.lead.updateMany({ where: { id: active.id, businessId: input.businessId, email: null }, data: { email: input.email } });
    }
    await addLeadCallLog(active.id, formJournalText(input, now));
    const lead = await prisma.lead.findFirst({ where: { id: active.id, businessId: input.businessId }, select: { id: true, name: true, stage: true } });
    return lead ? { ...lead, replacedPlaceholder } : null;
  } catch (err) {
    console.error("[alldog form-merge] failed — a new lead is created instead", err);
    return null;
  }
}
