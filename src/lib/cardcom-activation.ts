/**
 * Cardcom subscription activation — the single place that turns a verified
 * LowProfile charge into an active Petra subscription.
 *
 * Three callers used to carry their own copy of this logic (the server-to-server
 * indicator, the success redirect, and the client-triggered activate-pending
 * route), and all three decoded the business from `UserId` in Cardcom's verify
 * response. Cardcom does not return `UserId` for Operation=1 charges, so the
 * two server-side paths silently fell through and activation depended entirely
 * on the customer's browser reaching /payment/success with a live session.
 * When that didn't happen the customer was charged, nothing was activated and
 * no recurring order was created.
 *
 * `create-payment` already stores `Business.cardcomPendingCode = "{lowProfileCode}::{tier}"`,
 * so the business can always be resolved from the code alone. Everything here
 * is idempotent on the "activate" SubscriptionEvent keyed by lowprofileCode.
 */
import prisma from "@/lib/prisma";
import { isValidTier } from "@/lib/feature-flags";
import { encryptCardcomToken } from "@/lib/encryption";
import { sendUpgradeConfirmationEmail } from "@/lib/email";
import { notifyOwnerPaymentReceived } from "@/lib/notify-owner";
import {
  createCardcomRecurring,
  getPlanPrice,
  parseCardcomResponse,
  extractCardToken,
  extractTokenExpiry,
  extractDealId,
  extractAmount,
} from "@/lib/cardcom-recurring";

const SUBSCRIPTION_DAYS = 30;

/** Cardcom "עסקה ממתינה או לא נמצאה" — the customer never completed the payment. */
export const CARDCOM_NOT_FOUND_CODE = "5096";

// ── Verify ────────────────────────────────────────────────────────────────────

export type VerifyResult =
  | { ok: true; data: Record<string, string> }
  | { ok: false; responseCode: string; dealResponse: string; description: string };

/** Ask Cardcom whether a LowProfile code was actually paid. Read-only. */
export async function verifyLowProfile(lowProfileCode: string): Promise<VerifyResult> {
  const url = new URL("https://secure.cardcom.solutions/Interface/BillGoldGetLowProfileIndicator.aspx");
  url.searchParams.set("terminalnumber", process.env.CARDCOM_TERMINAL_NUMBER ?? "");
  url.searchParams.set("username", process.env.CARDCOM_API_USERNAME ?? "");
  url.searchParams.set("lowprofilecode", lowProfileCode);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Cardcom verify HTTP ${res.status} for ${lowProfileCode}`);
  }
  const data = parseCardcomResponse(await res.text());
  if (data.ResponseCode === "0" && data.DealResponse === "0") {
    return { ok: true, data };
  }
  return {
    ok: false,
    responseCode: data.ResponseCode ?? "",
    dealResponse: data.DealResponse ?? "",
    description: data.Description ?? "",
  };
}

// ── Resolve business + tier ───────────────────────────────────────────────────

/**
 * Which business and tier does this payment belong to?
 * 1. `UserId` ("{businessId}::{tier}") when Cardcom happens to echo it back.
 * 2. Otherwise the business whose `cardcomPendingCode` starts with the code —
 *    that is what create-payment wrote before opening the payment page.
 */
export async function resolveBusinessForPayment(
  data: Record<string, string>,
  lowProfileCode: string,
): Promise<{ businessId: string; tier: string; via: "userId" | "pendingCode" } | null> {
  const rawUserId = data.UserId ?? "";
  if (rawUserId) {
    const [businessId, tier] = rawUserId.split("::");
    if (businessId && isValidTier(tier)) return { businessId, tier, via: "userId" };
  }

  const business = await prisma.business.findFirst({
    where: { cardcomPendingCode: { startsWith: `${lowProfileCode}::` } },
    select: { id: true, cardcomPendingCode: true },
  });
  if (!business?.cardcomPendingCode) return null;
  const tier = business.cardcomPendingCode.split("::")[1] ?? "";
  if (!isValidTier(tier)) return null;
  return { businessId: business.id, tier, via: "pendingCode" };
}

// ── Activate ──────────────────────────────────────────────────────────────────

export interface ActivateParams {
  businessId: string;
  /** Tier the customer paid for (from UserId / pending code). */
  tier: string;
  lowProfileCode: string;
  /** Parsed Cardcom verify response for this code. */
  data: Record<string, string>;
  /** Which path activated it — stored on the event for later diagnosis. */
  source: "indicator" | "success-redirect" | "activate-pending" | "reconcile";
  ipAddress?: string;
}

export interface ActivateResult {
  alreadyActivated: boolean;
  /** Tier the business ended up on (may differ from the paid tier — see below). */
  tier: string;
  recurringId: string | null;
  recurringError: string | null;
}

/** Fields we never want in a stored event: the card token and its expiry. */
function redactForEvent(data: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (/token|tokef/i.test(k)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Activate a subscription from a verified payment. Idempotent per lowProfileCode.
 *
 * Never lowers a tier the platform owner set by hand: if the business is already
 * on a paid tier other than the one paid for, that tier is kept and the mismatch
 * is recorded on the event (the recurring order is still created at the price
 * the customer actually agreed to on the payment page).
 */
export async function activateVerifiedPayment(p: ActivateParams): Promise<ActivateResult> {
  const { businessId, lowProfileCode, data, source } = p;

  const existing = await prisma.subscriptionEvent.findFirst({
    where: { lowprofileCode: lowProfileCode, eventType: "activate" },
    select: { id: true, tier: true },
  });
  if (existing) {
    // Someone else won the race — just make sure the pending code is gone.
    await prisma.business.updateMany({
      where: { id: businessId, cardcomPendingCode: { startsWith: `${lowProfileCode}::` } },
      data: { cardcomPendingCode: null },
    });
    return { alreadyActivated: true, tier: existing.tier ?? p.tier, recurringId: null, recurringError: null };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, email: true, tier: true, cardcomRecurringId: true },
  });
  if (!business) throw new Error(`business ${businessId} not found`);

  const paidTier = p.tier;
  const keepManualTier = business.tier !== "free" && business.tier !== paidTier;
  const tier = keepManualTier ? business.tier : paidTier;

  const now = new Date();
  const subscriptionEndsAt = new Date(now.getTime() + SUBSCRIPTION_DAYS * 86_400_000);
  const dealId = extractDealId(data);
  const cardToken = extractCardToken(data);
  const tokenExpiry = extractTokenExpiry(data);

  await prisma.business.update({
    where: { id: businessId },
    data: {
      tier,
      subscriptionStatus: "active",
      subscriptionEndsAt,
      // Only overwrite token fields when the response actually contains them
      ...(dealId      ? { cardcomDealId:      dealId }                           : {}),
      ...(cardToken   ? { cardcomToken:       encryptCardcomToken(cardToken) }   : {}),
      ...(tokenExpiry ? { cardcomTokenExpiry: encryptCardcomToken(tokenExpiry) } : {}),
      cardcomPendingCode: null,
    },
  });

  await prisma.subscriptionEvent.create({
    data: {
      businessId,
      eventType: "activate",
      tier,
      cardcomDealId: dealId,
      amount: extractAmount(data) ?? getPlanPrice(paidTier)?.price ?? null,
      lowprofileCode: lowProfileCode,
      ipAddress: p.ipAddress ?? null,
      metadata: {
        ...redactForEvent(data),
        source,
        paidTier,
        ...(keepManualTier ? { keptManualTier: business.tier } : {}),
        subscriptionEndsAt: subscriptionEndsAt.toISOString(),
        hasToken: !!cardToken,
      },
    },
  });

  console.log(`cardcom-activation [${source}]: activated ${tier} for ${businessId}, deal ${dealId}`);

  const plan = getPlanPrice(paidTier);
  if (plan && business.email) {
    sendUpgradeConfirmationEmail({
      to: business.email,
      name: business.name ?? "",
      tierName: plan.label,
      tierPrice: plan.price,
    }).catch((e) => console.error("cardcom-activation: upgrade email failed:", e));
  }

  // Recurring order (הוראת קבע) — awaited: a fire-and-forget promise can be
  // killed on Vercel once the response is sent. Billed at the price the
  // customer agreed to, regardless of a manually kept higher tier.
  let recurringId: string | null = null;
  let recurringError: string | null = null;
  if (plan) {
    try {
      const result = await createCardcomRecurring({
        cardToken: cardToken ?? "",
        cardMonth: (data.CardValidityMonth ?? "").trim(),
        cardYear: data.CardValidityYear ?? "",
        cardOwnerId: data.CardOwnerID ?? "",
        price: plan.price,
        invoiceDescription: `מנוי ${plan.label} — חודשי`,
        companyName: business.name ?? "לקוח פטרה",
        email: business.email ?? "",
        existingRecurringId: business.cardcomRecurringId ?? undefined,
      });
      if (result.success && result.recurringId) {
        recurringId = result.recurringId;
        await prisma.business.update({
          where: { id: businessId },
          data: { cardcomRecurringId: result.recurringId },
        });
      } else {
        recurringError = result.error ?? "unknown";
        console.error(`cardcom-activation: recurring failed for ${businessId}:`, result.error);
      }
      await prisma.subscriptionEvent.create({
        data: {
          businessId,
          eventType: result.success ? "recurring_created" : "recurring_failed",
          tier,
          metadata: { recurringId: result.recurringId ?? null, error: result.error ?? null, source },
        },
      }).catch(() => null);
    } catch (err) {
      recurringError = err instanceof Error ? err.message : String(err);
      console.error(`cardcom-activation: recurring creation error for ${businessId}:`, err);
    }
  }

  // Tell the platform owner — every activation, whichever path caught it.
  // Awaited so Vercel does not kill it after the response.
  await notifyOwnerPaymentReceived({
    businessName: business.name ?? businessId,
    businessEmail: business.email,
    paidTier,
    effectiveTier: tier,
    amount: extractAmount(data) ?? plan?.price ?? null,
    dealId,
    recurringId,
    recurringError,
    source,
  }).catch((e) => console.error("cardcom-activation: owner notify failed:", e));

  return { alreadyActivated: false, tier, recurringId, recurringError };
}

// ── Reconcile ─────────────────────────────────────────────────────────────────

/** A pending code this old with "not found" at Cardcom is abandoned, not in flight. */
const ABANDONED_AFTER_MS = 48 * 60 * 60 * 1000;
/** Don't touch codes created in the last few minutes — the customer may still be paying. */
const MIN_AGE_MS = 15 * 60 * 1000;
const MAX_PER_RUN = 25;

export interface ReconcileOutcome {
  businessId: string;
  businessName: string;
  lowProfileCode: string;
  outcome: "activated" | "already_activated" | "abandoned" | "still_pending" | "error";
  detail?: string;
}

/**
 * Safety net for every business still carrying a `cardcomPendingCode`:
 * verify the code with Cardcom and activate if it was paid. Meant to run from
 * the daily renew cron, so a customer whose browser never reached the success
 * page is activated within a day instead of never.
 */
export async function reconcilePendingPayments(now = new Date()): Promise<ReconcileOutcome[]> {
  const cutoff = new Date(now.getTime() - MIN_AGE_MS);
  const pending = await prisma.business.findMany({
    where: { cardcomPendingCode: { not: null }, updatedAt: { lt: cutoff } },
    select: { id: true, name: true, cardcomPendingCode: true, updatedAt: true },
    orderBy: { updatedAt: "asc" },
    take: MAX_PER_RUN,
  });

  const outcomes: ReconcileOutcome[] = [];

  for (const biz of pending) {
    const [lowProfileCode, tier] = (biz.cardcomPendingCode ?? "").split("::");
    const base = { businessId: biz.id, businessName: biz.name ?? biz.id, lowProfileCode: lowProfileCode ?? "" };

    if (!lowProfileCode || !isValidTier(tier)) {
      await prisma.business.update({ where: { id: biz.id }, data: { cardcomPendingCode: null } });
      outcomes.push({ ...base, outcome: "abandoned", detail: "malformed pending code" });
      continue;
    }

    try {
      const verified = await verifyLowProfile(lowProfileCode);

      if (verified.ok) {
        const result = await activateVerifiedPayment({
          businessId: biz.id, tier, lowProfileCode, data: verified.data, source: "reconcile",
        });
        outcomes.push({
          ...base,
          outcome: result.alreadyActivated ? "already_activated" : "activated",
          detail: result.alreadyActivated
            ? undefined
            : `tier=${result.tier}${result.tier !== tier ? ` (paid ${tier})` : ""}, recurring=${result.recurringId ?? `FAILED: ${result.recurringError}`}`,
        });
        continue;
      }

      const ageMs = now.getTime() - biz.updatedAt.getTime();
      if (verified.responseCode === CARDCOM_NOT_FOUND_CODE && ageMs > ABANDONED_AFTER_MS) {
        await prisma.business.update({ where: { id: biz.id }, data: { cardcomPendingCode: null } });
        await prisma.subscriptionEvent.create({
          data: {
            businessId: biz.id,
            eventType: "pending_abandoned",
            tier,
            lowprofileCode: lowProfileCode,
            metadata: { responseCode: verified.responseCode, description: verified.description },
          },
        }).catch(() => null);
        outcomes.push({ ...base, outcome: "abandoned", detail: verified.description });
        continue;
      }

      outcomes.push({ ...base, outcome: "still_pending", detail: `${verified.responseCode} ${verified.description}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`reconcilePendingPayments: ${biz.id}:`, err);
      outcomes.push({ ...base, outcome: "error", detail: msg });
    }
  }

  return outcomes;
}
