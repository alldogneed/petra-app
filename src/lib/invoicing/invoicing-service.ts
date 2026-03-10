/**
 * Invoicing facade — main entry point for issuing documents.
 *
 * Usage:
 *   const result = await InvoicingService.issue(businessId, paymentId);
 *   const ok = await InvoicingService.testCredentials("morning", key, secret);
 */

import { prisma } from "../prisma";
import {
  decryptInvoicingSecret,
  encryptInvoicingSecret,
} from "../encryption";
import type {
  InvoicingProvider,
  InvoicingCredentials,
  IssuedDocument,
  DocumentType,
} from "./types";
import { DOCUMENT_TYPE_LABELS } from "./types";
import { DEFAULT_DOCUMENT_MAPPING } from "./constants";
import { morningProvider } from "./providers/morning";
import { maskSensitive, logInvoicing } from "./logger";

// ─── Provider registry ──────────────────────────────────────────────────────

function getProviderByName(name: string): InvoicingProvider {
  switch (name) {
    case "morning":
      return morningProvider;
    default:
      throw new Error(`ספק חשבוניות לא מוכר: ${name}`);
  }
}

// ─── Internal helpers ───────────────────────────────────────────────────────

async function loadSettings(businessId: string) {
  const settings = await prisma.invoicingSettings.findUnique({
    where: { businessId },
  });
  if (!settings) {
    throw new Error("אינטגרציית חשבוניות לא מוגדרת");
  }
  if (settings.status === "disabled") {
    throw new Error("אינטגרציית חשבוניות מושבתת");
  }
  return settings;
}

function decryptCredentials(settings: {
  apiKeyEncrypted: string;
  apiSecretEncrypted: string;
}): InvoicingCredentials {
  return {
    apiKey: decryptInvoicingSecret(settings.apiKeyEncrypted),
    apiSecret: decryptInvoicingSecret(settings.apiSecretEncrypted),
  };
}

function resolveDocType(
  paymentMethod: string,
  mappingJson: string
): DocumentType {
  let mapping: Record<string, number>;
  try {
    mapping = JSON.parse(mappingJson);
  } catch {
    mapping = {};
  }
  const merged = { ...DEFAULT_DOCUMENT_MAPPING, ...mapping };
  return (merged[paymentMethod] ?? 320) as DocumentType;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const InvoicingService = {
  /**
   * Test credentials without saving. Returns {success} or {success, error}.
   * Optionally updates lastTestedAt/lastTestResult on the settings record.
   */
  async testCredentials(
    providerName: string,
    apiKey: string,
    apiSecret: string,
    businessId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const provider = getProviderByName(providerName);
      await provider.authenticate({ apiKey, apiSecret });

      // Update test result if businessId provided (settings already saved)
      if (businessId) {
        await prisma.invoicingSettings.updateMany({
          where: { businessId },
          data: { lastTestedAt: new Date(), lastTestResult: "success", lastTestError: null },
        });
      }

      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "שגיאה לא ידועה";

      if (businessId) {
        await prisma.invoicingSettings.updateMany({
          where: { businessId },
          data: { lastTestedAt: new Date(), lastTestResult: "failure", lastTestError: errorMsg },
        });
      }

      return { success: false, error: errorMsg };
    }
  },

  /**
   * Save (or update) invoicing credentials for a business.
   */
  async saveSettings(
    businessId: string,
    providerName: string,
    apiKey: string,
    apiSecret: string,
    options?: {
      documentMapping?: Record<string, number>;
      webhookSecret?: string;
      configJson?: Record<string, unknown>;
    }
  ) {
    const apiKeyEncrypted = encryptInvoicingSecret(apiKey);
    const apiSecretEncrypted = encryptInvoicingSecret(apiSecret);
    const mappingJson = options?.documentMapping
      ? JSON.stringify(options.documentMapping)
      : JSON.stringify(DEFAULT_DOCUMENT_MAPPING);
    const webhookSecretEncrypted = options?.webhookSecret
      ? encryptInvoicingSecret(options.webhookSecret)
      : null;
    const configJson = options?.configJson
      ? JSON.stringify(options.configJson)
      : "{}";

    logInvoicing("info", "Saving invoicing settings", { businessId, providerName });

    return prisma.invoicingSettings.upsert({
      where: { businessId },
      create: {
        businessId,
        providerName,
        apiKeyEncrypted,
        apiSecretEncrypted,
        webhookSecretEncrypted,
        documentMapping: mappingJson,
        configJson,
        status: "active",
        connectedAt: new Date(),
      },
      update: {
        providerName,
        apiKeyEncrypted,
        apiSecretEncrypted,
        webhookSecretEncrypted,
        documentMapping: mappingJson,
        configJson,
        status: "active",
        lastError: null,
        connectedAt: new Date(),
      },
    });
  },

  /**
   * Issue a document for a payment.
   * Returns the saved InvoiceDocument record.
   */
  async issue(
    businessId: string,
    paymentId: string,
    options?: { docType?: DocumentType }
  ): Promise<IssuedDocument> {
    const settings = await loadSettings(businessId);
    const provider = getProviderByName(settings.providerName);
    const credentials = decryptCredentials(settings);

    // Authenticate
    let token: string;
    try {
      token = await provider.authenticate(credentials);
    } catch (err) {
      // Mark settings as errored
      await prisma.invoicingSettings.update({
        where: { businessId },
        data: {
          status: "error",
          lastError: err instanceof Error ? err.message : "שגיאת אימות",
        },
      });
      throw err;
    }

    // Load payment + customer (verify belongs to this business)
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, businessId },
      include: {
        customer: { select: { name: true, phone: true, email: true } },
        appointment: {
          include: { service: { select: { name: true } } },
        },
      },
    });
    if (!payment) throw new Error("תשלום לא נמצא");

    const docType =
      options?.docType ?? resolveDocType(payment.method, settings.documentMapping);

    const description = payment.appointment?.service?.name ?? "תשלום";

    // Issue
    logInvoicing("info", "Issuing document", { businessId, paymentId, docType });

    const result = await provider.issueDocument(token, {
      type: docType,
      customer: {
        name: payment.customer.name,
        phone: payment.customer.phone ?? undefined,
        email: payment.customer.email ?? undefined,
      },
      description,
      amount: payment.amount,
      paymentMethod: payment.method,
    });

    // Load business for VAT info
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { vatNumber: true, vatRate: true },
    });

    const vatRate = business?.vatRate ?? 0.17;
    const subtotal = payment.amount / (1 + vatRate);
    const taxTotal = payment.amount - subtotal;

    // Save document record with masked raw response
    await prisma.invoiceDocument.create({
      data: {
        businessId,
        paymentId,
        customerId: payment.customerId,
        providerName: settings.providerName,
        providerDocId: result.providerDocId,
        docType,
        docTypeName: DOCUMENT_TYPE_LABELS[docType] ?? String(docType),
        subtotal: Math.round(subtotal * 100) / 100,
        taxTotal: Math.round(taxTotal * 100) / 100,
        amount: payment.amount,
        currency: "ILS",
        vatRate,
        vatNumber: business?.vatNumber ?? null,
        documentUrl: result.documentUrl,
        documentNumber: result.documentNumber,
        providerRawJson: JSON.stringify(maskSensitive(result)),
        status: "issued",
      },
    });

    // Update payment with invoice number
    if (result.documentNumber) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { invoiceNumber: result.documentNumber },
      });
    }

    logInvoicing("info", "Document issued successfully", {
      documentNumber: result.documentNumber,
      providerDocId: result.providerDocId,
    });

    return result;
  },

  /**
   * Issue a standalone draft (no linked payment).
   * Loads the draft, sends to provider, updates the record.
   */
  async issueDraft(
    businessId: string,
    invoiceId: string
  ): Promise<IssuedDocument> {
    const settings = await loadSettings(businessId);
    const provider = getProviderByName(settings.providerName);
    const credentials = decryptCredentials(settings);

    const token = await provider.authenticate(credentials);

    const draft = await prisma.invoiceDocument.findUnique({
      where: { id: invoiceId },
      include: {
        customer: { select: { name: true, phone: true, email: true } },
      },
    });
    if (!draft) throw new Error("טיוטה לא נמצאה");

    // Parse lines from JSON
    let items: { description: string; quantity: number; unitPrice: number }[] = [];
    if (draft.linesJson) {
      try {
        items = JSON.parse(draft.linesJson);
      } catch { /* use empty */ }
    }

    const result = await provider.issueDocument(token, {
      type: draft.docType as DocumentType,
      customer: {
        name: draft.customer.name,
        phone: draft.customer.phone ?? undefined,
        email: draft.customer.email ?? undefined,
      },
      description: draft.notes ?? draft.docTypeName,
      amount: draft.amount,
      paymentMethod: "credit_card", // default for standalone
      items: items.length > 0 ? items : undefined,
    });

    await prisma.invoiceDocument.update({
      where: { id: invoiceId },
      data: {
        status: "issued",
        providerDocId: result.providerDocId,
        documentNumber: result.documentNumber,
        documentUrl: result.documentUrl,
        providerRawJson: JSON.stringify(maskSensitive(result)),
        failureReason: null,
      },
    });

    logInvoicing("info", "Draft issued successfully", {
      invoiceId,
      documentNumber: result.documentNumber,
    });

    return result;
  },

  /**
   * Check if invoicing is configured for a business.
   */
  async isConfigured(businessId: string): Promise<boolean> {
    const settings = await prisma.invoicingSettings.findUnique({
      where: { businessId },
      select: { status: true },
    });
    return !!settings && settings.status === "active";
  },
};
