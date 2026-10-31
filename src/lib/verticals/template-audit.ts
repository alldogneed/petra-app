/**
 * Phase 5 — which approved Meta templates can't go to a "generic" business's customers
 * as they are (body names Petra or uses dog wording). Pure: input = template name → body.
 * Run in production through GET /api/cron/sync-platform-templates (field `verticalAudit`).
 */
import { DOG_TEXT_RE } from "./help";

/** Template names sent to CUSTOMERS (owner alerts may say "פטרה" — they go to the platform owner). */
export function isCustomerTemplate(name: string): boolean {
  return !/_alert$|owner_alert|^petra_owner/.test(name);
}

export interface TemplateAuditRow {
  name: string;
  status: string;
  mentionsPetra: boolean;
  dogWording: boolean;
  /** The words that triggered the flag (no customer data — template text only). */
  matched: string[];
}

export function auditTemplatesForGeneric(
  templates: Map<string, { body: string; footer?: string | null; status?: string }>,
  namesInUse: readonly string[],
): TemplateAuditRow[] {
  const rows: TemplateAuditRow[] = [];
  for (const name of new Set(namesInUse)) {
    if (!isCustomerTemplate(name)) continue;
    const t = templates.get(name);
    if (!t) continue;
    const text = `${t.body}\n${t.footer ?? ""}`;
    const mentionsPetra = /פטרה|petra/i.test(text);
    const dogWording = DOG_TEXT_RE.test(text);
    if (mentionsPetra || dogWording) {
      const matched = [
        ...(text.match(/פטרה|petra/gi) ?? []),
        ...(text.match(new RegExp(DOG_TEXT_RE.source, "g")) ?? []).map((m) => m.trim()),
      ];
      rows.push({ name, status: t.status ?? "", mentionsPetra, dogWording, matched: [...new Set(matched)] });
    }
  }
  return rows;
}

/**
 * Approved hand-made templates whose bodies use dog wording (prod `verticalAudit`,
 * 31/10/2026). For a "generic" business each is swapped for its neutral catalog twin
 * (same params) or dropped (the flow then ends in the vertical-aware free text).
 * Dogs businesses never go through this map.
 */
export const GENERIC_TEMPLATE_SWAPS: Readonly<Record<string, string | null>> = {
  petra_appointment_reminder_v2: "petra_meeting_reminder",
  petra_appointment_reminder: null,
  petra_appointment_confirmation_v2: "petra_meeting_confirmation",
  petra_appointment_confirmation: null,
  petra_lead_followup: null,
  petra_boarding_checkout_v2: null,
  petra_boarding_checkout: null,
  petra_boarding_stay_summary: null,
  petra_boarding_thank_you_v2: null,
  petra_boarding_thank_you: null,
  petra_pet_birthday: null,
  petra_vaccination_reminder: null,
};

export function chainNeedsVerticalCheck(steps: readonly { name: string }[]): boolean {
  return steps.some((s) => s.name in GENERIC_TEMPLATE_SWAPS);
}

/** dogs → the chain unchanged; generic → dog-worded steps swapped / dropped, no duplicates. */
export function adaptChainForVertical<T extends { name: string; params: string[] }>(
  steps: readonly T[],
  vertical: string,
): T[] {
  if (vertical !== "generic") return [...steps];
  const out: T[] = [];
  const seen = new Set<string>();
  for (const step of steps) {
    const swap = step.name in GENERIC_TEMPLATE_SWAPS ? GENERIC_TEMPLATE_SWAPS[step.name] : step.name;
    if (!swap || seen.has(swap)) continue;
    seen.add(swap);
    out.push(swap === step.name ? step : { ...step, name: swap });
  }
  return out;
}
