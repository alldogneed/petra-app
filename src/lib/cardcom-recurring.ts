/**
 * Cardcom Recurring Billing (הוראת קבע) helpers.
 *
 * After a successful charge (via LowProfile Operation=2, BillAndCreateToken),
 * we create a recurring order in Cardcom using the returned card token
 * so Cardcom handles monthly billing automatically.
 * On cancellation, we deactivate the recurring order.
 */

// ── Response parser (shared with other Cardcom routes) ──────────────────────

export function parseCardcomResponse(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  text.split("&").forEach((pair) => {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) return;
    const k = decodeURIComponent(pair.slice(0, eqIdx));
    const v = decodeURIComponent(pair.slice(eqIdx + 1));
    result[k] = v;
  });
  return result;
}

// ── Field extraction helpers ────────────────────────────────────────────────
// Cardcom's LowProfile verify response (BillGoldGetLowProfileIndicator) does NOT
// return `DealNumber` / `SumToBill`; the real values live in ExtShvaParams.* —
// these helpers normalize both shapes.

/**
 * Cardcom card token (`Token`) — returned only by token-creating LowProfile
 * operations (2=BillAndCreateToken, 3=CreateTokenOnly).
 *
 * Never `ExtShvaParams.CardToken`: that is Shva's internal reference, not a
 * Cardcom token. Recurring orders created with it are accepted, then every
 * monthly charge fails with "8000 Token Not Found" (all orders 20006–20009,
 * found 2026-09-24).
 */
export function extractCardToken(data: Record<string, string>): string | null {
  return data.Token || null;
}

/** Token expiry in MMYY (e.g. "0329" = March 2029): `TokenExDate` or `ExtShvaParams.Tokef30`. */
export function extractTokenExpiry(data: Record<string, string>): string | null {
  return data.TokenExDate || data["ExtShvaParams.Tokef30"] || null;
}

/** Deal number: `InternalDealNumber` (verify response) or `DealNumber` (legacy). */
export function extractDealId(data: Record<string, string>): string | null {
  return data.InternalDealNumber || data.DealNumber || null;
}

/** Charged amount in ILS: `SumToBill` (ILS) or `ExtShvaParams.Sum36` (agorot). */
export function extractAmount(data: Record<string, string>): number | null {
  const ils = parseFloat(data.SumToBill ?? "");
  if (Number.isFinite(ils) && ils > 0) return ils;
  const agorot = parseInt(data["ExtShvaParams.Sum36"] ?? "", 10);
  if (Number.isFinite(agorot) && agorot > 0) return agorot / 100;
  return null;
}

// ── Plan prices (must match create-payment route) ───────────────────────────

const PLAN_PRICES: Record<string, { price: number; label: string }> = {
  basic:       { price: 99,  label: "Petra בייסיק" },
  pro:         { price: 199, label: "Petra פרו" },
  groomer:     { price: 169, label: "Petra גרומר+" },
  service_dog: { price: 229, label: "Petra Service Dog" },
};

export function getPlanPrice(tier: string): { price: number; label: string } | null {
  return PLAN_PRICES[tier] ?? null;
}

// ── Create recurring order ──────────────────────────────────────────────────

interface CreateRecurringParams {
  /** Cardcom card token (`Token` from a BillAndCreateToken / CreateTokenOnly deal) */
  cardToken: string;
  /** Card expiry month (1-12) */
  cardMonth: string;
  /** Card expiry year (e.g. "2030") */
  cardYear: string;
  /** Card owner ID number */
  cardOwnerId?: string;
  /** Monthly price in ILS */
  price: number;
  /** Description for invoices */
  invoiceDescription: string;
  /** Business name for Cardcom account */
  companyName: string;
  /** Business email for Cardcom account */
  email: string;
}

interface RecurringResult {
  success: boolean;
  recurringId?: string;
  accountId?: string;
  error?: string;
}

export async function createCardcomRecurring(params: CreateRecurringParams): Promise<RecurringResult> {
  const terminalNumber = process.env.CARDCOM_TERMINAL_NUMBER ?? "";
  const userName = process.env.CARDCOM_API_USERNAME ?? "";

  if (!terminalNumber || !userName) {
    return { success: false, error: "Missing Cardcom credentials" };
  }

  if (!params.cardToken) {
    return { success: false, error: "Missing card token" };
  }

  // Next billing date = 30 days from now
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + 30);
  const nextDateStr = `${String(nextDate.getDate()).padStart(2, "0")}/${String(nextDate.getMonth() + 1).padStart(2, "0")}/${nextDate.getFullYear()}`;

  const body = new URLSearchParams({
    TerminalNumber: terminalNumber,
    UserName: userName,
    Operation: "NewAndUpdate",
    codepage: "65001", // UTF-8 — without it Hebrew descriptions land garbled on the order and its invoices
    // Account
    "Account.CompanyName": params.companyName || "לקוח פטרה",
    "Account.Email": params.email,
    // Credit card token (from Cardcom deal)
    "CreditCard_1.Token": params.cardToken,
    ...(params.cardMonth ? { "CreditCard_1.Month": params.cardMonth } : {}),
    ...(params.cardYear ? { "CreditCard_1.Year": params.cardYear } : {}),
    ...(params.cardOwnerId ? { "CreditCard_1.CardOwnerID": params.cardOwnerId } : {}),
    // Recurring order
    "RecurringPayments.InternalDecription": params.invoiceDescription,
    "RecurringPayments.NextDateToBill": nextDateStr,
    "RecurringPayments.TotalNumOfBills": "99999", // effectively unlimited
    "RecurringPayments.TimeIntervalId": "1", // monthly
    "RecurringPayments.FinalDebitCoinId": "1", // ILS
    "RecurringPayments.IsActive": "true",
    "RecurringPayments.ChargeInTerminal": terminalNumber,
    // Flex item (line item for invoice)
    "RecurringPayments.FlexItem.InvoiceDescription": params.invoiceDescription,
    "RecurringPayments.FlexItem.Price": params.price.toString(),
    // Never send RecurringId here: Operation=NewAndUpdate treats the request as
    // "add new payment" and rejects any RecurringId (8500 "RecurringId is not
    // allow in Add New Payment"). Callers that already have an order keep it.
  });

  try {
    const res = await fetch(
      "https://secure.cardcom.solutions/interface/RecurringPayment.aspx",
      { method: "POST", body }
    );
    const text = await res.text();
    const data = parseCardcomResponse(text);

    if (data.ResponseCode !== "0") {
      console.error("Cardcom createRecurring error:", data);
      return { success: false, error: data.Description ?? "Unknown error" };
    }

    // Extract recurring ID from response
    const recurringId = data["Recurring0.RecurringId"] ?? data.RecurringId;
    const accountId = data.AccountId;
    return { success: true, recurringId, accountId };
  } catch (err) {
    console.error("Cardcom createRecurring fetch error:", err);
    return { success: false, error: String(err) };
  }
}

// ── Cancel (deactivate) recurring order ─────────────────────────────────────

export async function cancelCardcomRecurring(recurringId: string): Promise<{ success: boolean; error?: string }> {
  const terminalNumber = process.env.CARDCOM_TERMINAL_NUMBER ?? "";
  const userName = process.env.CARDCOM_API_USERNAME ?? "";

  if (!terminalNumber || !userName) {
    return { success: false, error: "Missing Cardcom credentials" };
  }

  // UpdatePayments, not NewAndUpdate: without an Account block Cardcom treats
  // NewAndUpdate as "add new payment" and rejects the RecurringId
  // (8500 "RecurringId is not allow in Add New Payment"), so the order stayed
  // active and the customer kept being billed after cancelling.
  const body = new URLSearchParams({
    TerminalNumber: terminalNumber,
    UserName: userName,
    Operation: "UpdatePayments",
    "RecurringPayments.RecurringId": recurringId,
    "RecurringPayments.IsActive": "false",
  });

  try {
    const res = await fetch(
      "https://secure.cardcom.solutions/interface/RecurringPayment.aspx",
      { method: "POST", body }
    );
    const text = await res.text();
    const data = parseCardcomResponse(text);

    if (data.ResponseCode !== "0") {
      console.error("Cardcom cancelRecurring error:", data);
      return { success: false, error: `${data.ResponseCode}: ${data.Description ?? "Unknown error"}` };
    }
    // Make sure Cardcom updated THIS order rather than creating a new one.
    if (data["Recurring0.RecurringId"] !== recurringId || data["Recurring0.IsNewRecurring"] === "true") {
      console.error("Cardcom cancelRecurring unexpected response:", data);
      return { success: false, error: `unexpected response (RecurringId=${data["Recurring0.RecurringId"] ?? "-"}, IsNewRecurring=${data["Recurring0.IsNewRecurring"] ?? "-"})` };
    }

    return { success: true };
  } catch (err) {
    console.error("Cardcom cancelRecurring fetch error:", err);
    return { success: false, error: String(err) };
  }
}
