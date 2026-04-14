/**
 * Cardcom Recurring Billing (הוראת קבע) helpers.
 *
 * After a successful one-time charge (via LowProfile Operation=1),
 * we create a recurring order in Cardcom using the card token
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
  /** Card token (GUID) from Cardcom deal — ExtShvaParams.CardToken */
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
  /** Existing recurring ID to update (prevents duplicates) */
  existingRecurringId?: string;
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
    // If updating existing order
    ...(params.existingRecurringId
      ? { "RecurringPayments.RecurringId": params.existingRecurringId }
      : {}),
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

  const body = new URLSearchParams({
    TerminalNumber: terminalNumber,
    UserName: userName,
    Operation: "NewAndUpdate",
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
      return { success: false, error: data.Description ?? "Unknown error" };
    }

    return { success: true };
  } catch (err) {
    console.error("Cardcom cancelRecurring fetch error:", err);
    return { success: false, error: String(err) };
  }
}
