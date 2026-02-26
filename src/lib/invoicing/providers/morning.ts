/**
 * Morning (Green Invoice) provider adapter.
 * API docs: https://www.greeninvoice.co.il/api-docs
 */

import type {
  InvoicingProvider,
  InvoicingCredentials,
  IssueDocumentInput,
  IssuedDocument,
} from "../types";
import { MORNING_PAYMENT_TYPES } from "../constants";
import { logInvoicing } from "../logger";
import { sanitizeForProvider } from "../validator";

const BASE_URL = "https://api.greeninvoice.co.il/api/v1";

async function morningFetch(
  path: string,
  token: string,
  body?: unknown
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export const morningProvider: InvoicingProvider = {
  async authenticate(credentials: InvoicingCredentials): Promise<string> {
    logInvoicing("info", "Authenticating with Morning API");

    const res = await fetch(`${BASE_URL}/account/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: credentials.apiKey,
        secret: credentials.apiSecret,
      }),
    });

    if (!res.ok) {
      const status = res.status;
      if (status === 401 || status === 403) {
        throw new Error("מפתח API לא תקין — בדוק את הפרטים ונסה שוב");
      }
      const text = await res.text().catch(() => "");
      throw new Error(`שגיאת אימות Morning (${status}): ${text}`);
    }

    const data = await res.json();
    logInvoicing("info", "Morning authentication successful");
    return data.token as string;
  },

  async issueDocument(
    token: string,
    input: IssueDocumentInput
  ): Promise<IssuedDocument> {
    const paymentTypeCode = MORNING_PAYMENT_TYPES[input.paymentMethod] ?? 1;

    const items =
      input.items && input.items.length > 0
        ? input.items.map((item) => ({
            description: sanitizeForProvider(item.description),
            quantity: item.quantity,
            price: item.unitPrice,
          }))
        : [
            {
              description: sanitizeForProvider(input.description),
              quantity: 1,
              price: input.amount,
            },
          ];

    const payload = {
      type: input.type,
      client: {
        name: sanitizeForProvider(input.customer.name),
        phone: input.customer.phone || undefined,
        emails: input.customer.email ? [input.customer.email] : [],
      },
      income: items,
      payment: [
        {
          type: paymentTypeCode,
          price: input.amount,
          date: new Date().toISOString().slice(0, 10),
        },
      ],
      currency: "ILS",
      lang: "he",
    };

    logInvoicing("info", "Issuing document via Morning", {
      docType: input.type,
      amount: input.amount,
    });

    const res = await morningFetch("/documents", token, payload);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const status = res.status;
      logInvoicing("error", "Morning document issuance failed", { status, text });
      if (status >= 400 && status < 500) {
        throw new Error(`שגיאת הפקת מסמך (${status}): ${text}`);
      }
      throw new Error(`שגיאת שרת Morning (${status}): ${text}`);
    }

    const doc = await res.json();

    logInvoicing("info", "Document issued successfully", {
      providerDocId: doc.id,
      documentNumber: doc.number,
    });

    return {
      providerDocId: doc.id,
      documentNumber: doc.number ?? null,
      documentUrl: doc.url ?? null,
      type: input.type,
      amount: input.amount,
    };
  },

  async getDocumentUrl(
    token: string,
    providerDocId: string
  ): Promise<string | null> {
    const res = await morningFetch(`/documents/${providerDocId}`, token);
    if (!res.ok) return null;
    const doc = await res.json();
    return (doc.url as string) ?? null;
  },
};

/**
 * Verify a Morning (Green Invoice) webhook signature.
 * Uses HMAC-SHA256 with timing-safe comparison.
 */
export function verifyMorningWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac, timingSafeEqual } = require("crypto") as typeof import("crypto");

  const expected = createHmac("sha256", secret).update(body).digest("hex");

  if (expected.length !== signature.length) return false;

  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex")
  );
}
