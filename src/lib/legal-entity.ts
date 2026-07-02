/**
 * Legal entity types (סוג עוסק) — single source of truth.
 *
 * Canonical keys are the exact strings stored in Business.legalEntityType:
 *   "עוסק פטור" | "עוסק מורשה" | "חברה"
 *
 * Used by: settings, onboarding, checkout→Business mapping (cardcom routes),
 * invoicing (VAT suppression + doc-type forcing), services/business.ts validation.
 */

export const LEGAL_ENTITY_TYPES = [
  { key: "עוסק פטור", label: "עוסק פטור", vatExempt: true, regNumberLabel: "מספר עוסק" },
  { key: "עוסק מורשה", label: "עוסק מורשה (ע.מ)", vatExempt: false, regNumberLabel: "מספר עוסק מורשה" },
  { key: "חברה", label: "חברה בע\"מ (ח.פ)", vatExempt: false, regNumberLabel: "מספר ח.פ" },
] as const;

export type LegalEntityKey = (typeof LEGAL_ENTITY_TYPES)[number]["key"];

/** Canonical keys, for validation (derived — never hardcode elsewhere). */
export const VALID_LEGAL_ENTITY_TYPES: readonly string[] = LEGAL_ENTITY_TYPES.map((t) => t.key);

/** עוסק פטור is the only VAT-exempt entity type. */
export const isVatExempt = (t?: string | null) => t === "עוסק פטור";

/** Display label + reg-number field label for a stored key. */
export function getLegalEntityMeta(key?: string | null) {
  return LEGAL_ENTITY_TYPES.find((t) => t.key === key) ?? null;
}

/**
 * Map free-form labels (e.g. the checkout UI options "חברה (ח.פ)",
 * "עוסק מורשה (ע.מ)", "עוסק פטור" — and the canonical keys themselves)
 * to a canonical key. Unknown → null.
 */
export function normalizeLegalEntityLabel(label?: string | null): string | null {
  if (!label || typeof label !== "string") return null;
  const trimmed = label.trim();
  if (!trimmed) return null;

  // Exact canonical key
  if (VALID_LEGAL_ENTITY_TYPES.includes(trimmed)) return trimmed;

  // Known display labels (this module's + checkout variants)
  const LABEL_MAP: Record<string, LegalEntityKey> = {
    "עוסק פטור": "עוסק פטור",
    "עוסק מורשה (ע.מ)": "עוסק מורשה",
    "עוסק מורשה (ע״מ)": "עוסק מורשה",
    "חברה (ח.פ)": "חברה",
    "חברה (ח״פ)": "חברה",
    "חברה בע\"מ (ח.פ)": "חברה",
    "חברה בע״מ (ח.פ)": "חברה",
    "חברה בע\"מ": "חברה",
    "חברה בע״מ": "חברה",
  };
  if (LABEL_MAP[trimmed]) return LABEL_MAP[trimmed];

  // Prefix fallback — labels like 'עוסק מורשה ...' / 'חברה ...'
  if (trimmed.startsWith("עוסק פטור")) return "עוסק פטור";
  if (trimmed.startsWith("עוסק מורשה")) return "עוסק מורשה";
  if (trimmed.startsWith("חברה")) return "חברה";

  return null;
}
