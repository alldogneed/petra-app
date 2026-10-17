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
import { billingProfile, cardUpdateFirstBillDate } from "@/lib/subscription-billing";
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

  const cardToken = extractCardToken(data);
  if (!cardToken) return fail("Cardcom לא החזיר טוקן לכרטיס");

  const { amount, paidTier } = await billingProfile(businessId, business.tier);
  const price = amount ?? getPlanPrice(business.tier)?.price ?? null;
  if (!price) return fail(`לא ידוע הסכום החודשי למסלול ${business.tier}`);
  const plan = getPlanPrice(paidTier) ?? getPlanPrice(business.tier);

  const firstBill = cardUpdateFirstBillDate(business.subscriptionEndsAt);
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

  const encryptedToken = safeEncryptCardcomToken(cardToken);
  const encryptedExpiry = safeEncryptCardcomToken(extractTokenExpiry(data));
  await prisma.business.update({
    where: { id: businessId },
    data: {
      cardcomRecurringId: created.recurringId,
      ...(encryptedToken ? { cardcomToken: encryptedToken } : {}),
      ...(encryptedExpiry ? { cardcomTokenExpiry: encryptedExpiry } : {}),
    },
  });

  // Two live orders would bill twice — deactivate the old one (it can't charge anyway).
  const previousRecurringId = business.cardcomRecurringId;
  let previousCancelled: boolean | null = null;
  let cancelError: string | null = null;
  if (previousRecurringId && previousRecurringId !== created.recurringId) {
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
        recurringId: created.recurringId,
        previousRecurringId,
        previousCancelled,
        cancelError,
        firstBillDate: firstBill.toISOString(),
        tokenStored: !!encryptedToken,
      },
    },
  });

  await sendEmail({
    to: OWNER_ALERT_EMAIL,
    subject: `‏💳 Petra: ${business.name ?? businessId} עדכן/ה אמצעי תשלום`,
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;">
      <p><b>${esc(business.name ?? businessId)}</b> הזין/ה כרטיס חדש.</p>
      <ul>
        <li>הוראת קבע חדשה: ${esc(created.recurringId)} — ₪${price} לחודש, חיוב ראשון ${firstBill.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })}</li>
        <li>הוראה קודמת: ${esc(previousRecurringId ?? "אין")}${previousRecurringId ? (previousCancelled ? " — כובתה" : ` — <b style="color:#b91c1c">כיבוי נכשל (${esc(cancelError ?? "")}) — לכבות ידנית בקארדקום</b>`) : ""}</li>
        ${encryptedToken ? "" : `<li style="color:#b91c1c">הטוקן לא נשמר אצלנו (CARDCOM_ENCRYPTION_KEY חסר) — הוראת הקבע עדיין תקינה</li>`}
      </ul></div>`,
  }).catch((e) => console.error("card-update: owner email failed:", e));

  return { status: "updated", recurringId: created.recurringId, firstBill, previousRecurringId, previousCancelled };
}
