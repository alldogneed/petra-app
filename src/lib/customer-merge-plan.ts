/**
 * Customer merge plan — PURE (no Prisma / no IO). Client-safe.
 *
 * Merging a duplicate customer ("source") INTO the customer that stays ("target"):
 * every row that references source.id is re-pointed to target.id, then source is
 * deleted. This module is the single source of truth for WHICH rows reference a
 * customer and HOW each is merged; `src/services/customer-merge.ts` executes it.
 *
 * `src/lib/__tests__/customer-merge-plan.test.ts` parses prisma/schema.prisma and
 * fails when a model gains a field that relates to Customer which is not listed
 * here — add a row (and its handler in the service, enforced by the type
 * `Record<MergeRelationKey, …>`) whenever that happens.
 */

export type MergeRelationKind =
  /** Prisma relation field to Customer (FK). */
  | "fk"
  /** Plain String column holding a customer id (no FK in the schema). */
  | "scalar"
  /** Polymorphic `relatedEntityType = "CUSTOMER"` + `relatedEntityId` pair. */
  | "entity_ref";

export interface MergeRelation {
  /** Stable key — used in preview/merge counts. */
  key: string;
  /** Prisma model name as written in schema.prisma. */
  model: string;
  /** Column holding the customer id. */
  field: string;
  kind: MergeRelationKind;
  /** Hebrew label for the preview UI. */
  label: string;
  /** Whether the model has a NON-nullable businessId column (the update filter includes it). */
  scopedByBusinessId: boolean;
  /**
   * Unique constraints that include `field`, and how a collision is resolved.
   * None of the current relations have one; the test fails if the schema gains
   * one without this being set.
   */
  onUniqueConflict?: "skip_duplicate";
}

export const MERGE_RELATIONS = [
  { key: "pets", model: "Pet", field: "customerId", kind: "fk", label: "חיות", scopedByBusinessId: false },
  { key: "appointments", model: "Appointment", field: "customerId", kind: "fk", label: "תורים", scopedByBusinessId: true },
  { key: "payments", model: "Payment", field: "customerId", kind: "fk", label: "תשלומים", scopedByBusinessId: true },
  { key: "orders", model: "Order", field: "customerId", kind: "fk", label: "הזמנות", scopedByBusinessId: true },
  { key: "bookings", model: "Booking", field: "customerId", kind: "fk", label: "הזמנות אונליין", scopedByBusinessId: true },
  { key: "boardingStays", model: "BoardingStay", field: "customerId", kind: "fk", label: "שהיות פנסיון", scopedByBusinessId: true },
  { key: "leads", model: "Lead", field: "customerId", kind: "fk", label: "לידים", scopedByBusinessId: true },
  { key: "trainingPrograms", model: "TrainingProgram", field: "customerId", kind: "fk", label: "תוכניות אימון", scopedByBusinessId: true },
  { key: "trainingGroupParticipants", model: "TrainingGroupParticipant", field: "customerId", kind: "fk", label: "השתתפות בקבוצות", scopedByBusinessId: false },
  { key: "trainingGroupAttendance", model: "TrainingGroupAttendance", field: "customerId", kind: "scalar", label: "נוכחות בקבוצות", scopedByBusinessId: false },
  { key: "scheduledMessages", model: "ScheduledMessage", field: "customerId", kind: "fk", label: "הודעות מתוזמנות", scopedByBusinessId: true },
  { key: "intakeForms", model: "IntakeForm", field: "customerId", kind: "fk", label: "טפסי קליטה", scopedByBusinessId: true },
  { key: "contractRequests", model: "ContractRequest", field: "customerId", kind: "fk", label: "חוזים", scopedByBusinessId: true },
  { key: "invoiceJobs", model: "InvoiceJob", field: "customerId", kind: "fk", label: "משימות חשבונית", scopedByBusinessId: true },
  { key: "invoiceDocuments", model: "InvoiceDocument", field: "customerId", kind: "fk", label: "מסמכי חשבונית", scopedByBusinessId: true },
  { key: "serviceDogRecipients", model: "ServiceDogRecipient", field: "customerId", kind: "fk", label: "זכאי כלבי שירות", scopedByBusinessId: true },
  { key: "timelineEvents", model: "TimelineEvent", field: "customerId", kind: "fk", label: "אירועי ציר זמן", scopedByBusinessId: true },
  { key: "tasks", model: "Task", field: "relatedEntityId", kind: "entity_ref", label: "משימות", scopedByBusinessId: true },
  { key: "taskRecurrenceRules", model: "TaskRecurrenceRule", field: "relatedEntityId", kind: "entity_ref", label: "משימות חוזרות", scopedByBusinessId: true },
  { key: "onboardingProgress", model: "OnboardingProgress", field: "lastCustomerId", kind: "scalar", label: "התקדמות קליטה", scopedByBusinessId: false },
] as const satisfies readonly MergeRelation[];

export type MergeRelationKey = (typeof MERGE_RELATIONS)[number]["key"];
export type MergeCounts = Record<MergeRelationKey, number>;

/** Value of relatedEntityType that marks a customer reference. */
export const CUSTOMER_ENTITY_TYPE = "CUSTOMER";

/**
 * Scalar String columns that hold a customer id but deliberately are NOT re-pointed.
 * (Audit/analytics history keeps the original id.) Format: "Model.field".
 */
export const MERGE_IGNORED_SCALARS: readonly string[] = [];

export const MERGE_LABELS: Record<MergeRelationKey, string> = Object.fromEntries(
  MERGE_RELATIONS.map((r) => [r.key, r.label]),
) as Record<MergeRelationKey, string>;

export function emptyMergeCounts(): MergeCounts {
  return Object.fromEntries(MERGE_RELATIONS.map((r) => [r.key, 0])) as MergeCounts;
}

export function totalMergeCount(counts: Partial<MergeCounts>): number {
  return Object.values(counts).reduce<number>((s, n) => s + (typeof n === "number" ? n : 0), 0);
}

// ─── Customer field merge ────────────────────────────────────────────────────

/** Column caps — same as PatchCustomerSchema in /api/customers/[id]. */
export const MERGE_FIELD_LIMITS = {
  email: 100,
  address: 500,
  idNumber: 20,
  secondContactName: 100,
  secondContactPhone: 20,
  notes: 5000,
  tags: 1000,
} as const;

export interface MergeableCustomer {
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  idNumber: string | null;
  secondContactName: string | null;
  secondContactPhone: string | null;
  notes: string | null;
  tags: string;
  documents: string;
}

export type CustomerMergeUpdate = Partial<
  Pick<
    MergeableCustomer,
    "email" | "address" | "idNumber" | "secondContactName" | "secondContactPhone" | "notes" | "tags" | "documents"
  >
>;

function isBlank(v: string | null | undefined): boolean {
  return v == null || v.trim() === "";
}

function parseJsonArray(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Union of two tag JSON arrays: target order first, then new source tags; case-insensitive dedupe. */
export function mergeTags(targetRaw: string | null | undefined, sourceRaw: string | null | undefined): string {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of [...parseJsonArray(targetRaw), ...parseJsonArray(sourceRaw)]) {
    if (typeof t !== "string") continue;
    const trimmed = t.trim();
    if (!trimmed) continue;
    const k = trimmed.toLocaleLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(trimmed);
  }
  // Keep under the column cap used by the PATCH schema — drop trailing tags if needed.
  while (out.length > 0 && JSON.stringify(out).length > MERGE_FIELD_LIMITS.tags) out.pop();
  return JSON.stringify(out);
}

/** Concat both documents arrays; dedupe by `id` (or `url`) so re-running a merge is idempotent. */
export function mergeDocuments(targetRaw: string | null | undefined, sourceRaw: string | null | undefined): string {
  const out: unknown[] = [];
  const seen = new Set<string>();
  for (const d of [...parseJsonArray(targetRaw), ...parseJsonArray(sourceRaw)]) {
    if (d && typeof d === "object") {
      const rec = d as Record<string, unknown>;
      const k = typeof rec.id === "string" && rec.id ? `id:${rec.id}` : typeof rec.url === "string" && rec.url ? `url:${rec.url}` : null;
      if (k) {
        if (seen.has(k)) continue;
        seen.add(k);
      }
    }
    out.push(d);
  }
  return JSON.stringify(out);
}

export function mergeNotesHeader(sourceName: string): string {
  return `ממוזג מ${sourceName}: `;
}

/**
 * Notes: target kept; empty target ← source; both → target + "\n---\nממוזג מ<name>: " + source.
 * Idempotent: when the target already contains the source notes, nothing is appended.
 * Capped at 5000 chars.
 */
export function mergeNotes(targetNotes: string | null, sourceNotes: string | null, sourceName: string): string | null {
  const t = targetNotes ?? "";
  const s = (sourceNotes ?? "").trim();
  if (!s) return targetNotes;
  if (isBlank(t)) return s.slice(0, MERGE_FIELD_LIMITS.notes);
  if (t.includes(s)) return targetNotes;
  return `${t}\n---\n${mergeNotesHeader(sourceName)}${s}`.slice(0, MERGE_FIELD_LIMITS.notes);
}

/**
 * Field-level merge. Returns ONLY the fields that change on the target
 * (empty object = nothing to write). Target values always win; empty target
 * fields are filled from the source. name/phone/source stay the target's.
 */
export function buildCustomerMergeUpdate(target: MergeableCustomer, source: MergeableCustomer): CustomerMergeUpdate {
  const update: CustomerMergeUpdate = {};
  const fill = ["email", "address", "idNumber", "secondContactName", "secondContactPhone"] as const;
  for (const f of fill) {
    if (isBlank(target[f]) && !isBlank(source[f])) {
      update[f] = (source[f] as string).trim().slice(0, MERGE_FIELD_LIMITS[f]);
    }
  }
  const notes = mergeNotes(target.notes, source.notes, source.name);
  if (notes !== target.notes) update.notes = notes;

  const tags = mergeTags(target.tags, source.tags);
  if (tags !== normalizeJsonArrayString(target.tags)) update.tags = tags;

  const documents = mergeDocuments(target.documents, source.documents);
  if (documents !== normalizeJsonArrayString(target.documents)) update.documents = documents;

  return update;
}

function normalizeJsonArrayString(raw: string | null | undefined): string {
  return JSON.stringify(parseJsonArray(raw));
}

/** The typed confirmation the merge POST requires. */
export function mergeConfirmToken(sourceId: string): string {
  return `MERGE_${sourceId}`;
}

/** Phone → last 9 digits (Israeli national number without leading 0 / 972). */
export function phoneTail(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.slice(-9);
}
