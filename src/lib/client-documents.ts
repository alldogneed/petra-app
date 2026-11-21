/**
 * Client documents + contracts — pure helpers (no DB, no secrets).
 *
 * Used by `src/services/client-documents.ts` (MCP `list_client_documents` and the
 * documents/contract line of `get_client`). Request: גבעת הכלבים 21/11/2026 — their
 * agent needs to check from the connector whether a customer / dog has documents and
 * a signed contract.
 *
 * Real data shapes (all JSON arrays stored as text, or Json that may hold a JSON string):
 * - `Customer.documents` (String, default "[]") — `{ id, name, originalName, mimeType, size,
 *   url, category: contract|invoice|receipt|agreement|medical|insurance|other, createdAt }`.
 * - `Pet.attachments` (String, default "[]") — `{ id, name, originalName?, mimeType, size, url,
 *   type?: document|photo|medical|certificate|vaccination|other|profile_photo, createdAt }`.
 * - `ServiceDogProfile.documents` (Json, often a JSON *string*) — `{ id, name, url?, docType:
 *   MEDICAL|TRAINING|LEGAL|INSURANCE|ID|OTHER|TRAINING_CERT, uploadedAt, isFile, fileName, fileSize }`.
 * - `ContractRequest` rows — status PENDING | SIGNED | EXPIRED, signedAt, expiresAt,
 *   template name, optional pet, `signedFileUrl` (never exposed here — only `hasSignedFile`).
 */

export type ClientDocumentSource = "customer" | "pet" | "service_dog";

export interface ClientDocument {
  id: string | null;
  name: string;
  /** Stored category / type key (lower-case), e.g. "contract", "medical". */
  category: string | null;
  /** ISO timestamp, null when missing / unreadable. */
  uploadedAt: string | null;
  source: ClientDocumentSource;
  petId?: string;
  petName?: string;
  mimeType?: string | null;
  size?: number | null;
  /** Only plain public Vercel Blob URLs (the same link the UI shows). */
  url?: string;
}

/** Parse a stored JSON document list safely. Accepts an array, a JSON string, or a Json column holding a JSON string. */
export function parseDocList(raw: unknown): Record<string, unknown>[] {
  let v: unknown = raw;
  for (let i = 0; i < 2 && typeof v === "string"; i++) {
    try {
      v = JSON.parse(v || "[]");
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  return v.filter((d): d is Record<string, unknown> => !!d && typeof d === "object" && !Array.isArray(d));
}

const BLOB_URL_RE = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[^\s"'<>]+$/i;

/** True for a plain public Vercel Blob URL (never data: URIs, tokens or other hosts). */
export function isPublicBlobUrl(u: unknown): u is string {
  return typeof u === "string" && u.length <= 1000 && BLOB_URL_RE.test(u);
}

function str(v: unknown, max = 255): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== "string" && !(v instanceof Date)) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Pet attachment types that are not documents (the avatar). */
const NON_DOCUMENT_TYPES = new Set(["profile_photo"]);

/**
 * Normalise one stored list. Never copies file contents (`data` / base64) or unknown keys.
 */
export function normalizeDocs(
  raw: unknown,
  source: ClientDocumentSource,
  pet?: { id: string; name: string }
): ClientDocument[] {
  const out: ClientDocument[] = [];
  for (const d of parseDocList(raw)) {
    const categoryRaw = str(d.category, 40) ?? str(d.type, 40) ?? str(d.docType, 40);
    const category = categoryRaw ? categoryRaw.toLowerCase() : null;
    if (category && NON_DOCUMENT_TYPES.has(category)) continue;
    const name = str(d.name) ?? str(d.originalName) ?? str(d.fileName) ?? "מסמך ללא שם";
    const doc: ClientDocument = {
      id: str(d.id, 100),
      name,
      category,
      uploadedAt: isoOrNull(d.createdAt) ?? isoOrNull(d.uploadedAt),
      source,
      mimeType: str(d.mimeType, 100),
      size: typeof d.size === "number" ? d.size : typeof d.fileSize === "number" ? d.fileSize : null,
    };
    if (pet) {
      doc.petId = pet.id;
      doc.petName = pet.name;
    }
    if (isPublicBlobUrl(d.url)) doc.url = d.url;
    out.push(doc);
  }
  return out;
}

/** Newest first; undated last (stable otherwise). */
export function sortDocsNewestFirst<T extends { uploadedAt: string | null }>(docs: T[]): T[] {
  return docs
    .map((d, i) => ({ d, i }))
    .sort((a, b) => {
      const ta = a.d.uploadedAt ? Date.parse(a.d.uploadedAt) : -Infinity;
      const tb = b.d.uploadedAt ? Date.parse(b.d.uploadedAt) : -Infinity;
      if (ta !== tb) return tb - ta;
      return a.i - b.i;
    })
    .map((x) => x.d);
}

export const DOC_CATEGORY_HE: Record<string, string> = {
  contract: "חוזה",
  agreement: "הסכם",
  invoice: "חשבונית",
  receipt: "קבלה",
  medical: "רפואי",
  insurance: "ביטוח",
  document: "מסמך",
  photo: "תמונה",
  certificate: "תעודה",
  vaccination: "חיסונים",
  training: "אילוף",
  training_cert: "מבחן הסמכה",
  legal: "משפטי",
  id: "תעודה מזהה",
  other: "אחר",
};

export function docCategoryHe(category: string | null | undefined): string {
  if (!category) return "אחר";
  return DOC_CATEGORY_HE[category] ?? category;
}

/** Customer-card documents uploaded manually as a contract / agreement. */
export function isContractCategory(category: string | null | undefined): boolean {
  return category === "contract" || category === "agreement";
}

// ─── Contracts ───────────────────────────────────────────────────────────────

export interface ContractRow {
  id: string;
  status: string;
  templateName: string | null;
  petName: string | null;
  createdAt: Date | string;
  sentAt: Date | string | null;
  openedAt: Date | string | null;
  signedAt: Date | string | null;
  expiresAt: Date | string | null;
  hasSignedFile: boolean;
}

export type ContractEffectiveStatus = "SIGNED" | "OPENED" | "PENDING" | "EXPIRED";

/** Stored status + time → what the business should read (a PENDING link past its expiry is expired). */
export function contractEffectiveStatus(c: Pick<ContractRow, "status" | "signedAt" | "openedAt" | "expiresAt">, now: Date): ContractEffectiveStatus {
  if (c.status === "SIGNED" || (c.signedAt && c.status !== "EXPIRED")) return "SIGNED";
  if (c.status === "EXPIRED") return "EXPIRED";
  if (c.expiresAt && new Date(c.expiresAt).getTime() < now.getTime()) return "EXPIRED";
  return c.openedAt ? "OPENED" : "PENDING";
}

export const CONTRACT_STATUS_HE: Record<ContractEffectiveStatus, string> = {
  SIGNED: "נחתם",
  OPENED: "נפתח, טרם נחתם",
  PENDING: "נשלח, ממתין לחתימה",
  EXPIRED: "פג תוקף (לא נחתם)",
};

/** Calendar year of a timestamp in Israel time. */
export function israelYear(d: Date | string): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric" }).format(new Date(d)));
}

export interface ContractSummary {
  total: number;
  signedCount: number;
  /** PENDING / OPENED (not expired). */
  awaitingCount: number;
  latestSigned: { id: string; templateName: string | null; petName: string | null; signedAt: string } | null;
  signedThisYear: boolean;
  /** Signed contracts per Israel calendar year, newest year first. */
  signedByYear: Array<{ year: number; count: number }>;
}

export function contractSummary(contracts: ContractRow[], now: Date): ContractSummary {
  const signed = contracts
    .filter((c) => contractEffectiveStatus(c, now) === "SIGNED")
    .map((c) => ({ c, at: new Date(c.signedAt ?? c.createdAt) }))
    .filter((x) => !isNaN(x.at.getTime()))
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  const byYear = new Map<number, number>();
  for (const { at } of signed) {
    const y = israelYear(at);
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  const thisYear = israelYear(now);
  const latest = signed[0];
  return {
    total: contracts.length,
    signedCount: signed.length,
    awaitingCount: contracts.filter((c) => {
      const s = contractEffectiveStatus(c, now);
      return s === "PENDING" || s === "OPENED";
    }).length,
    latestSigned: latest
      ? { id: latest.c.id, templateName: latest.c.templateName, petName: latest.c.petName, signedAt: latest.at.toISOString() }
      : null,
    signedThisYear: byYear.has(thisYear),
    signedByYear: Array.from(byYear.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, count]) => ({ year, count })),
  };
}

/** Contracts newest first (signed date, else sent / created). */
export function sortContractsNewestFirst<T extends Pick<ContractRow, "signedAt" | "sentAt" | "createdAt">>(rows: T[]): T[] {
  const t = (c: T) => new Date(c.signedAt ?? c.sentAt ?? c.createdAt).getTime() || 0;
  return [...rows].sort((a, b) => t(b) - t(a));
}
