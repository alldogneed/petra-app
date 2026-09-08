/**
 * Cardcom transaction list — the only way to learn that a monthly recurring
 * charge actually went through.
 *
 * `RecurringPayment.aspx` has no read operation: it answers
 * `8500 Unknow Operation 'Get' only allow : NewAndUpdate, UpdateAccount, UpdatePayments`.
 * The renewal check therefore looks at the terminal's transactions instead and
 * matches the charge back to a business by card identity.
 */

const API_BASE = "https://secure.cardcom.solutions/api/v11";
const PAGE_SIZE = 2000; // Cardcom allows 10–2000

export interface CardcomTransaction {
  TranzactionId?: number;
  Amount?: number;
  /** ISO-ish local timestamp, e.g. "2026-09-04T15:50:40" */
  CreateDate?: string;
  ApprovalNumber?: string;
  /** 0 = approved */
  ResponseCode?: number;
  IsRefund?: boolean;
  Last4CardDigits?: number;
  Last4CardDigitsString?: string;
  CardOwnerIdentityNumber?: string;
  CardOwnerName?: string;
  DocumentNumber?: number;
  Token?: string;
}

/** Cardcom wants DDMMYYYY. */
function toCardcomDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}${p(d.getMonth() + 1)}${d.getFullYear()}`;
}

/**
 * All transactions on the terminal between two dates (inclusive).
 * Throws with a readable message when credentials are missing or Cardcom refuses —
 * callers turn that into an owner alert rather than swallowing it.
 */
export async function listTerminalTransactions(from: Date, to: Date): Promise<CardcomTransaction[]> {
  const terminal = process.env.CARDCOM_TERMINAL_NUMBER ?? "";
  const apiName = process.env.CARDCOM_API_USERNAME ?? "";
  const apiPassword = process.env.CARDCOM_API_PASSWORD ?? "";

  if (!terminal || !apiName) throw new Error("CARDCOM_TERMINAL_NUMBER / CARDCOM_API_USERNAME not configured");
  if (!apiPassword) throw new Error("CARDCOM_API_PASSWORD not configured — cannot verify monthly charges");

  const out: CardcomTransaction[] = [];
  // Paged defensively; a terminal rarely has >2000 deals in the short windows we ask for.
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${API_BASE}/Transactions/ListTransactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        TerminalNumber: Number(terminal),
        ApiName: apiName,
        ApiPassword: apiPassword,
        FromDate: toCardcomDate(from),
        ToDate: toCardcomDate(to),
        Page: page,
        Page_size: PAGE_SIZE,
      }),
    });
    if (!res.ok) throw new Error(`Cardcom ListTransactions HTTP ${res.status}`);

    const json = (await res.json()) as {
      ResponseCode?: number;
      Description?: string;
      // Cardcom's own spelling
      Tranzactions?: CardcomTransaction[];
    };
    if (json.ResponseCode !== 0) {
      throw new Error(`Cardcom ListTransactions ${json.ResponseCode}: ${json.Description ?? ""}`);
    }
    const batch = json.Tranzactions ?? [];
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return out;
}

// ── Matching a charge to a business ──────────────────────────────────────────

/**
 * How we recognise a business's card on the terminal.
 *
 * The platform terminal also processes the owner's own client charges, so a
 * charge is only credited to a business when the card identity AND the expected
 * subscription amount both line up.
 */
export interface CardIdentity {
  /** CardOwnerID from the original activation (Israeli ID of the cardholder). */
  cardOwnerId: string | null;
  /** Last 4 digits from the original activation. */
  last4: string | null;
}

/** Read the card identity a business paid with, from its latest activation event. */
export function cardIdentityFromEventMetadata(metadata: unknown): CardIdentity {
  const m = (metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    cardOwnerId: str(m["CardOwnerID"]) ?? str(m["ExtShvaParams.CardHolderIdentityNumber"]),
    last4: str(m["ExtShvaParams.CardNumber5"]),
  };
}

function txLast4(tx: CardcomTransaction): string | null {
  if (tx.Last4CardDigitsString) return tx.Last4CardDigitsString.padStart(4, "0");
  if (typeof tx.Last4CardDigits === "number") return String(tx.Last4CardDigits).padStart(4, "0");
  return null;
}

function parseTxDate(tx: CardcomTransaction): Date | null {
  if (!tx.CreateDate) return null;
  const d = new Date(tx.CreateDate);
  return isNaN(d.getTime()) ? null : d;
}

export interface ChargeMatch {
  transactionId: number | null;
  amount: number;
  chargedAt: Date;
  approvalNumber: string | null;
}

/**
 * Newest successful charge on this card, for this amount, at or after `notBefore`.
 *
 * Requires at least one card identifier to match — never credits a charge to a
 * business we cannot positively identify.
 */
export function findChargeForBusiness(
  transactions: CardcomTransaction[],
  identity: CardIdentity,
  expectedAmount: number,
  notBefore: Date,
): ChargeMatch | null {
  if (!identity.cardOwnerId && !identity.last4) return null;

  let best: ChargeMatch | null = null;

  for (const tx of transactions) {
    if (tx.ResponseCode !== 0) continue;
    if (tx.IsRefund) continue;
    if (typeof tx.Amount !== "number" || Math.abs(tx.Amount - expectedAmount) > 0.01) continue;

    const when = parseTxDate(tx);
    if (!when || when < notBefore) continue;

    // Both identifiers must agree when we hold both; one is enough when that is
    // all the original activation recorded.
    const ownerOk = identity.cardOwnerId
      ? (tx.CardOwnerIdentityNumber ?? "").trim() === identity.cardOwnerId
      : null;
    const last4Ok = identity.last4 ? txLast4(tx) === identity.last4.padStart(4, "0") : null;
    const checks = [ownerOk, last4Ok].filter((v): v is boolean => v !== null);
    if (checks.length === 0 || checks.some((v) => !v)) continue;

    if (!best || when > best.chargedAt) {
      best = {
        transactionId: tx.TranzactionId ?? null,
        amount: tx.Amount,
        chargedAt: when,
        approvalNumber: tx.ApprovalNumber ?? null,
      };
    }
  }

  return best;
}
