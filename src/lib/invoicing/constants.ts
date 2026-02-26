/**
 * Invoicing constants.
 */

import { DOCUMENT_TYPES } from "./types";

export const INVOICING_PROVIDERS = [
  {
    id: "morning",
    label: "Morning (חשבונית ירוקה)",
    description: "חשבוניות וקבלות דיגיטליות דרך Green Invoice",
  },
] as const;

/** Morning (Green Invoice) payment type codes */
export const MORNING_PAYMENT_TYPES: Record<string, number> = {
  cash: 1,
  check: 2,
  credit_card: 3,
  bank_transfer: 4,
  bit: 10,
  paybox: 10,
};

/** Default mapping: payment method → document type */
export const DEFAULT_DOCUMENT_MAPPING: Record<string, number> = {
  cash: DOCUMENT_TYPES.TAX_INVOICE_RECEIPT,
  credit_card: DOCUMENT_TYPES.TAX_INVOICE_RECEIPT,
  bank_transfer: DOCUMENT_TYPES.TAX_INVOICE_RECEIPT,
  bit: DOCUMENT_TYPES.RECEIPT,
  paybox: DOCUMENT_TYPES.RECEIPT,
  check: DOCUMENT_TYPES.TAX_INVOICE_RECEIPT,
};
