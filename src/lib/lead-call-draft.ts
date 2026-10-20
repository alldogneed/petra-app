/**
 * Unsaved call-log draft in the lead card ("תיעוד שיחה").
 *
 * A tap outside the drawer closes it; without a draft everything typed was lost.
 * The draft lives in this browser only (per viewer, per lead) and is cleared once
 * the call log is saved. Storage may be unavailable (private mode) — every access
 * is wrapped so the card keeps working without it.
 */

export interface LeadCallDraft {
  summary: string;
  treatment: string;
  nextFollowUpAt: string;
  followUpStatus: string;
  savedAt: number;
}

/** Drafts older than this are ignored and removed. */
export const LEAD_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const key = (leadId: string) => `petra:lead-call-draft:${leadId}`;

/** A draft is worth keeping only when the user actually typed call notes. */
export function hasDraftContent(d: Pick<LeadCallDraft, "summary" | "treatment">): boolean {
  return d.summary.trim().length > 0 || d.treatment.trim().length > 0;
}

/** Pure parse — exported for tests. Returns null for missing / broken / expired drafts. */
export function parseLeadCallDraft(raw: string | null, now: number = Date.now()): LeadCallDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<LeadCallDraft>;
    if (typeof d.savedAt !== "number" || now - d.savedAt > LEAD_DRAFT_TTL_MS) return null;
    const draft: LeadCallDraft = {
      summary: typeof d.summary === "string" ? d.summary : "",
      treatment: typeof d.treatment === "string" ? d.treatment : "",
      nextFollowUpAt: typeof d.nextFollowUpAt === "string" ? d.nextFollowUpAt : "",
      followUpStatus: typeof d.followUpStatus === "string" ? d.followUpStatus : "pending",
      savedAt: d.savedAt,
    };
    return hasDraftContent(draft) ? draft : null;
  } catch {
    return null;
  }
}

export function loadLeadCallDraft(leadId: string): LeadCallDraft | null {
  try {
    const raw = window.localStorage.getItem(key(leadId));
    const draft = parseLeadCallDraft(raw);
    if (raw && !draft) window.localStorage.removeItem(key(leadId));
    return draft;
  } catch {
    return null;
  }
}

/** Saves the draft, or removes it when there is nothing typed. */
export function saveLeadCallDraft(leadId: string, d: Omit<LeadCallDraft, "savedAt">): void {
  try {
    if (!hasDraftContent(d)) {
      window.localStorage.removeItem(key(leadId));
      return;
    }
    window.localStorage.setItem(key(leadId), JSON.stringify({ ...d, savedAt: Date.now() }));
  } catch {
    // storage full / blocked — the draft is a convenience only
  }
}

export function clearLeadCallDraft(leadId: string): void {
  try {
    window.localStorage.removeItem(key(leadId));
  } catch {
    // ignore
  }
}
