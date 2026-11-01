/**
 * Signed-contract PDF branding (docs/verticals phase 3). The PDF itself is the business's
 * own template + the signature — no Petra marks. For a "generic" business its name goes
 * into the document metadata (author / creator / producer); dogs → pdf-lib's defaults,
 * as before.
 */
import type { PDFDocument } from "pdf-lib";
import { normalizeVertical } from "./index";

export function applyPdfBranding(pdfDoc: PDFDocument, src: { vertical?: string | null; businessName: string }): boolean {
  if (normalizeVertical(src.vertical) !== "generic") return false;
  const name = src.businessName.trim();
  if (!name) return false;
  pdfDoc.setAuthor(name);
  pdfDoc.setCreator(name);
  pdfDoc.setProducer(name);
  return true;
}
