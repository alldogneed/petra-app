/**
 * Invoicing integration types & document type constants.
 */

// ─── Document types (Israel Tax Authority codes) ────────────────────────────

export const DOCUMENT_TYPES = {
  TAX_INVOICE: 305,
  TAX_INVOICE_RECEIPT: 320,
  RECEIPT: 400,
  CREDIT_NOTE: 330,
} as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];

export const DOCUMENT_TYPE_LABELS: Record<number, string> = {
  [DOCUMENT_TYPES.TAX_INVOICE]: "חשבונית מס",
  [DOCUMENT_TYPES.TAX_INVOICE_RECEIPT]: "חשבונית מס / קבלה",
  [DOCUMENT_TYPES.RECEIPT]: "קבלה",
  [DOCUMENT_TYPES.CREDIT_NOTE]: "חשבונית זיכוי",
};

// ─── Credentials ────────────────────────────────────────────────────────────

export interface InvoicingCredentials {
  apiKey: string;
  apiSecret: string;
}

// ─── Issue document input ───────────────────────────────────────────────────

export interface IssueDocumentItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface IssueDocumentInput {
  type: DocumentType;
  customer: {
    name: string;
    phone?: string;
    email?: string;
  };
  description: string;
  amount: number;
  paymentMethod: string;
  items?: IssueDocumentItem[];
}

// ─── Issued document result ─────────────────────────────────────────────────

export interface IssuedDocument {
  providerDocId: string;
  documentNumber: string | null;
  documentUrl: string | null;
  type: DocumentType;
  amount: number;
}

// ─── Provider interface ─────────────────────────────────────────────────────

export interface InvoicingProvider {
  /** Authenticate and return a session token */
  authenticate(credentials: InvoicingCredentials): Promise<string>;

  /** Issue a document, returns provider result */
  issueDocument(
    token: string,
    input: IssueDocumentInput
  ): Promise<IssuedDocument>;

  /** Get the PDF URL for a document */
  getDocumentUrl(token: string, providerDocId: string): Promise<string | null>;
}
