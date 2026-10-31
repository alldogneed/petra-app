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
}

export function auditTemplatesForGeneric(
  templates: Map<string, { body: string; footer?: string | null; status?: string }>,
  namesInUse: readonly string[],
): TemplateAuditRow[] {
  const rows: TemplateAuditRow[] = [];
  for (const name of namesInUse) {
    if (!isCustomerTemplate(name)) continue;
    const t = templates.get(name);
    if (!t) continue;
    const text = `${t.body}\n${t.footer ?? ""}`;
    const mentionsPetra = /פטרה|petra/i.test(text);
    const dogWording = DOG_TEXT_RE.test(text);
    if (mentionsPetra || dogWording) rows.push({ name, status: t.status ?? "", mentionsPetra, dogWording });
  }
  return rows;
}
