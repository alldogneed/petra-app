/**
 * "עדכון אמצעי תשלום" — replace the card a subscription is billed on, without charging.
 *
 * Why it exists: recurring orders created before 2026-09-24 were built on Shva's
 * internal reference instead of a Cardcom token, so every monthly charge fails
 * ("8000 Token Not Found") and the business silently drops to free. Those
 * customers need a working token, but they already paid for the current period —
 * a regular payment would charge them twice.
 *
 * Flow: LowProfile Operation=3 (CreateTokenOnly, ₪0) → /api/cardcom/card-update-indicator
 * → verify with Cardcom → new recurring order whose first charge is the day the
 * paid period ends → old order deactivated → token stored (encrypted) →
 * `card_updated` event (also the card the renewal cron matches charges against).
 */
import prisma from "@/lib/prisma";
import { buildIndicatorUrl } from "@/lib/security/cardcom-helpers";
import {
  parseCardcomResponse,
  createCardcomRecurring,
  cancelCardcomRecurring,
  extractCardToken,
  extractTokenExpiry,
  getPlanPrice,
} from "@/lib/cardcom-recurring";
import { safeEncryptCardcomToken } from "@/lib/cardcom-activation";
import { billingProfile, cardUpdateFirstBillDate, canUpdateCard } from "@/lib/subscription-billing";
import {
  cardIdentityFromEventMetadata,
  findChargeForBusiness,
  listTerminalTransactions,
  type CardIdentity,
} from "@/lib/cardcom-transactions";
import { sendEmail } from "@/lib/email";

export const CARD_UPDATE_INDICATOR = "/api/cardcom/card-update-indicator";
/** UserId suffix that marks a LowProfile session as a card update (never a payment). */
export const CARD_UPDATE_MARKER = "cardupdate";
const OWNER_ALERT_EMAIL = "info@petra-app.com";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Open a ₪0 Cardcom page that only saves a card. Returns the iframe/redirect URL. */
export async function startCardUpdate(p: { businessId: string; email: string | null; tierLabel: string }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://petra-app.com";
  const params = new URLSearchParams({
    TerminalNumber: process.env.CARDCOM_TERMINAL_NUMBER ?? "",
    UserName: process.env.CARDCOM_API_USERNAME ?? "",
    APILevel: "10",
    codepage: "65001",
    Operation: "3", // CreateTokenOnly — the card is saved, not charged
    Language: "he",
    SumToBill: "0",
    CoinID: "1",
    ProductName: `${p.tierLabel} — עדכון אמצעי תשלום`,
    GoodURL: `${appUrl}/settings?tab=subscription&card=updated`,
    SuccessRedirectUrl: `${appUrl}/settings?tab=subscription&card=updated`,
    ErrorURL: `${appUrl}/settings?tab=subscription&card=error`,
    ErrorRedirectUrl: `${appUrl}/settings?tab=subscription&card=error`,
    IndicatorURL: buildIndicatorUrl(CARD_UPDATE_INDICATOR),
    UserId: `${p.businessId}::${CARD_UPDATE_MARKER}`,
    ShowLogoutButton: "false",
    ...(p.email ? { Email: p.email } : {}),
  });

  const res = await fetch("https://secure.cardcom.solutions/Interface/LowProfile.aspx", { method: "POST", body: params });
  const result = parseCardcomResponse(await res.text());
  if (result.ResponseCode !== "0") {
    throw new Error(result.Description || "שגיאה בפתיחת טופס עדכון כרטיס");
  }
  const lowProfileCode = result.LowProfileCode ?? null;
  // Fallback for resolving the business if Cardcom doesn't echo UserId back.
  if (lowProfileCode) {
    await prisma.subscriptionEvent.create({
      data: { businessId: p.businessId, eventType: "card_update_started", lowprofileCode: lowProfileCode, metadata: {} },
    }).catch(() => null);
  }
  return { url: result.url ?? null, lowProfileCode };
}

/** Which business does this verified card-update session belong to? null = not a card update. */
export async function resolveCardUpdateBusiness(data: Record<string, string>, lowProfileCode: string): Promise<string | null> {
  const [businessId, marker] = (data.UserId ?? "").split("::");
  if (businessId && marker === CARD_UPDATE_MARKER) return businessId;
  const started = await prisma.subscriptionEvent.findFirst({
    where: { lowprofileCode: lowProfileCode, eventType: "card_update_started" },
    select: { businessId: true },
  });
  return started?.businessId ?? null;
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

export type CardUpdateOutcome =
  | { status: "duplicate" }
  | { status: "updated"; recurringId: string; firstBill: Date; previousRecurringId: string | null; previousCancelled: boolean | null }
  | { status: "failed"; error: string };

/**
 * Apply a verified card-update session. Idempotent per lowProfileCode.
 * Never touches tier / subscriptionStatus / subscriptionEndsAt — access is unchanged;
 * only the card and the recurring order are replaced.
 */
export async function applyCardUpdate(p: {
  businessId: string;
  lowProfileCode: string;
  data: Record<string, string>;
  ipAddress?: string | null;
}): Promise<CardUpdateOutcome> {
  const { businessId, lowProfileCode, data } = p;

  const done = await prisma.subscriptionEvent.findFirst({
    where: { lowprofileCode: lowProfileCode, eventType: { in: ["card_updated", "card_update_failed"] } },
    select: { id: true },
  });
  if (done) return { status: "duplicate" };

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, email: true, tier: true, subscriptionStatus: true, subscriptionEndsAt: true, cardcomRecurringId: true },
  });
  if (!business) return { status: "failed", error: "business not found" };

  const fail = async (error: string): Promise<CardUpdateOutcome> => {
    await prisma.subscriptionEvent.create({
      data: { businessId, eventType: "card_update_failed", tier: business.tier, lowprofileCode: lowProfileCode, ipAddress: p.ipAddress ?? null, metadata: { error } },
    }).catch(() => null);
    await sendEmail({
      to: OWNER_ALERT_EMAIL,
      subject: `‏⚠️ Petra: עדכון כרטיס נכשל — ${business.name ?? businessId}`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;"><p>הלקוח <b>${esc(business.name ?? businessId)}</b> הזין כרטיס חדש, אבל לא נוצרה הוראת קבע: ${esc(error)}</p><p>הוראת הקבע הקודמת (${esc(business.cardcomRecurringId ?? "-")}) לא שונתה.</p></div>`,
    }).catch((e) => console.error("card-update: owner alert failed:", e));
    return { status: "failed", error };
  };

  // Re-check at confirmation time: the owner may have cancelled (or dropped to free)
  // between opening the Cardcom page and submitting it — never bill them again.
  if (!canUpdateCard(business)) return fail(`המנוי אינו פעיל (${business.subscriptionStatus ?? "-"} / ${business.tier}) — לא נוצרה הוראת קבע`);

  const cardToken = extractCardToken(data);
  if (!cardToken) return fail("Cardcom לא החזיר טוקן לכרטיס");

  const { amount, paidTier, identity: previousIdentity } = await billingProfile(businessId, business.tier);
  const price = amount ?? getPlanPrice(business.tier)?.price ?? null;
  if (!price) return fail(`לא ידוע הסכום החודשי למסלול ${business.tier}`);
  const plan = getPlanPrice(paidTier) ?? getPlanPrice(business.tier);

  // The renewal cron recognises the monthly charge by card owner ID / last 4 digits.
  const newIdentity = cardIdentityFromEventMetadata(data);
  const identityMissing = !newIdentity.cardOwnerId && !newIdentity.last4;

  // If the (working) old order already charged this period, start the new one a month later.
  const alreadyCharged = await chargedThisPeriod(business.subscriptionEndsAt, previousIdentity, price);
  const firstBill = alreadyCharged
    ? new Date(alreadyCharged.getTime() + 30 * 86_400_000)
    : cardUpdateFirstBillDate(business.subscriptionEndsAt);

  const created = await createCardcomRecurring({
    cardToken,
    cardMonth: (data.CardValidityMonth ?? "").trim(),
    cardYear: data.CardValidityYear ?? "",
    cardOwnerId: data.CardOwnerID ?? "",
    price,
    invoiceDescription: `מנוי ${plan?.label ?? "Petra"} — חודשי`,
    companyName: business.name ?? "לקוח פטרה",
    email: business.email ?? "",
    nextBillDate: firstBill,
  });
  if (!created.success || !created.recurringId) return fail(created.error ?? "יצירת הוראת קבע נכשלה");
  const newRecurringId = created.recurringId;

  // From here a live order exists at Cardcom. Any failure must turn it off again,
  // or a retry / parallel call would leave two orders billing the customer.
  const previousRecurringId = business.cardcomRecurringId;
  let previousCancelled: boolean | null = null;
  let cancelError: string | null = null;
  let tokenStored = false;
  try {
    const encryptedToken = safeEncryptCardcomToken(cardToken);
    const encryptedExpiry = safeEncryptCardcomToken(extractTokenExpiry(data));
    tokenStored = !!encryptedToken;
    // Compare-and-swap: only the call that still sees the old order wins. A parallel
    // indicator call (or a second session) that lost the race undoes its own order.
    const swapped = await prisma.business.updateMany({
      where: { id: businessId, cardcomRecurringId: previousRecurringId },
      data: {
        cardcomRecurringId: newRecurringId,
        ...(encryptedToken ? { cardcomToken: encryptedToken } : {}),
        ...(encryptedExpiry ? { cardcomTokenExpiry: encryptedExpiry } : {}),
      },
    });
    if (swapped.count === 0) {
      const undo = await cancelCardcomRecurring(newRecurringId);
      if (!undo.success) return fail(`עדכון כפול — ההוראה הכפולה ${newRecurringId} לא כובתה (${undo.error ?? ""}) — לכבות ידנית בקארדקום`);
      return { status: "duplicate" };
    }

    if (previousRecurringId && previousRecurringId !== newRecurringId) {
      const cancel = await cancelCardcomRecurring(previousRecurringId);
      previousCancelled = cancel.success;
      cancelError = cancel.error ?? null;
    }

    await prisma.subscriptionEvent.create({
      data: {
        businessId,
        eventType: "card_updated",
        tier: business.tier,
        amount: price,
        lowprofileCode: lowProfileCode,
        ipAddress: p.ipAddress ?? null,
        metadata: {
          ...redactForEvent(data),
          paidTier,
          recurringId: newRecurringId,
          previousRecurringId,
          previousCancelled,
          cancelError,
          firstBillDate: firstBill.toISOString(),
          ...(alreadyCharged ? { previousOrderChargedAt: alreadyCharged.toISOString() } : {}),
          tokenStored,
          ...(identityMissing ? { identityMissing: true } : {}),
        },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("card-update: failed after creating the order:", err);
    const undo = await cancelCardcomRecurring(newRecurringId).catch((e) => ({ success: false, error: String(e) }));
    // Put the old order reference back if the swap already happened.
    await prisma.business.updateMany({
      where: { id: businessId, cardcomRecurringId: newRecurringId },
      data: { cardcomRecurringId: previousRecurringId },
    }).catch(() => null);
    return fail(`שגיאה אחרי יצירת ההוראה ${newRecurringId}: ${msg}${undo.success ? " (ההוראה החדשה כובתה)" : " — ההוראה החדשה לא כובתה, לכבות ידנית בקארדקום"}`);
  }
  const recurringId = newRecurringId;
  const encryptedToken = tokenStored;

  await sendEmail({
    to: OWNER_ALERT_EMAIL,
    subject: `‏💳 Petra: ${business.name ?? businessId} עדכן/ה אמצעי תשלום`,
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;">
      <p><b>${esc(business.name ?? businessId)}</b> הזין/ה כרטיס חדש.</p>
      <ul>
        <li>הוראת קבע חדשה: ${esc(recurringId)} — ₪${price} לחודש, חיוב ראשון ${firstBill.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })}${alreadyCharged ? " (ההוראה הקודמת כבר חייבה את התקופה הנוכחית)" : ""}</li>
        <li>הוראה קודמת: ${esc(previousRecurringId ?? "אין")}${previousRecurringId ? (previousCancelled ? " — כובתה" : ` — <b style="color:#b91c1c">כיבוי נכשל (${esc(cancelError ?? "")}) — לכבות ידנית בקארדקום</b>`) : ""}</li>
        ${encryptedToken ? "" : `<li style="color:#b91c1c">הטוקן לא נשמר אצלנו (CARDCOM_ENCRYPTION_KEY חסר) — הוראת הקבע עדיין תקינה</li>`}
        ${identityMissing ? `<li style="color:#b91c1c">Cardcom לא החזיר ת.ז./4 ספרות לכרטיס — החידוש האוטומטי לא יוכל לזהות את החיוב. לבדוק ידנית בתאריך החיוב.</li>` : ""}
      </ul></div>`,
  }).catch((e) => console.error("card-update: owner email failed:", e));

  return { status: "updated", recurringId, firstBill, previousRecurringId, previousCancelled };
}

/**
 * Did the current order already charge this period (period end − 3 days onward)?
 * Only working orders can — then the new order must start a month later, not
 * charge the same period again. Unknown (feed down, no identity) → null.
 */
async function chargedThisPeriod(endsAt: Date | null, identity: CardIdentity, amount: number): Promise<Date | null> {
  if (!endsAt || (!identity.cardOwnerId && !identity.last4)) return null;
  const notBefore = new Date(endsAt.getTime() - 3 * 86_400_000);
  if (notBefore.getTime() > Date.now()) return null; // the billing day hasn't come yet
  try {
    const tx = await listTerminalTransactions(new Date(notBefore.getTime() - 2 * 86_400_000), new Date(Date.now() + 86_400_000));
    return findChargeForBusiness(tx, identity, amount, notBefore)?.chargedAt ?? null;
  } catch (err) {
    console.error("card-update: could not read Cardcom transactions:", err);
    return null;
  }
}
