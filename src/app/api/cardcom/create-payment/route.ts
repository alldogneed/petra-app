export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { isValidTier, type TierKey } from "@/lib/feature-flags";
import { createOwnerLead } from "@/lib/owner-lead";
import { buildIndicatorUrl, validateOrigin, validateInvoiceFields } from "@/lib/security/cardcom-helpers";
import { rateLimitRedis, RL } from "@/lib/security/redis-rate-limiter";

// ─── Cardcom plan definitions ─────────────────────────────────────────────────
// Maps Petra tier keys to Cardcom billing params.
// UserId sent to Cardcom encodes "businessId::tier" so the indicator can decode both.

const CARDCOM_PLANS: Record<
  string,
  { price: number; label: string; days: number }
> = {
  basic:       { price: 99,  label: "Petra בייסיק",       days: 30  },
  pro:         { price: 199, label: "Petra פרו",           days: 30  },
  groomer:     { price: 169, label: "Petra גרומר+",        days: 30  },
  service_dog: { price: 229, label: "Petra Service Dog",   days: 30  },
};

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    // CSRF protection
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "בקשה לא מורשית" }, { status: 403 });
    }

    // Rate limiting per business
    const rl = await rateLimitRedis("cardcom:payment", businessId, RL.CARDCOM_AUTH);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי ניסיונות. נסה שוב בעוד מספר דקות." }, { status: 429 });
    }

    const body = await request.json();
    const tier: string = body.tier;
    const { phone, address, vatNumber, businessType, billingEmail } = validateInvoiceFields(body);

    if (!isValidTier(tier) || !(tier in CARDCOM_PLANS)) {
      return NextResponse.json({ error: "מסלול לא תקין" }, { status: 400 });
    }

    const plan = CARDCOM_PLANS[tier];

    // ── Test mode: allow admin/owner to override price for QA ─────────────
    const OWNER_EMAIL = "alldogneed@gmail.com";
    const testAmount = body.testAmount ? parseFloat(body.testAmount) : null;
    const isTestMode = testAmount != null && testAmount > 0 && testAmount < plan.price;
    // Only allow test amount for the platform owner
    const { session } = authResult;
    if (isTestMode && session.user.email !== OWNER_EMAIL) {
      return NextResponse.json({ error: "מצב בדיקה זמין רק לבעל המערכת" }, { status: 403 });
    }
    const chargeAmount = isTestMode ? testAmount : plan.price;

    // Fetch business email for pre-filling Cardcom form + save invoice fields
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { email: true, name: true, phone: true },
    });
    if (!business) {
      return NextResponse.json({ error: "עסק לא נמצא" }, { status: 404 });
    }

    // Save invoice fields if provided
    if (address || vatNumber || businessType) {
      await prisma.business.update({
        where: { id: businessId },
        data: {
          ...(address      ? { address }      : {}),
          ...(vatNumber    ? { vatNumber }    : {}),
          ...(businessType ? { businessRegNumber: businessType } : {}),
        },
      });
    }

    // Create lead in owner's Petra account (fire-and-forget)
    createOwnerLead({
      name: session.user.name,
      email: billingEmail ?? business.email ?? undefined,
      phone: business.phone ?? undefined,
      businessName: business.name,
      tier,
      businessType,
      vatNumber,
      address,
      billingEmail,
    }).catch(() => null);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://petra-app.com";

    // Encode businessId + tier into UserId so indicator can read both back
    const encodedUserId = `${businessId}::${tier}`;

    const invoiceEmail = billingEmail ?? business.email ?? "";
    const invoicePhone = phone ?? business.phone ?? "";
    const isVatFree = businessType === "עוסק פטור";

    const params = new URLSearchParams({
      TerminalNumber:   process.env.CARDCOM_TERMINAL_NUMBER ?? "",
      UserName:         process.env.CARDCOM_API_USERNAME ?? "",
      APILevel:         "10",
      codepage:         "65001",
      Operation:        "1",          // charge
      Language:         "he",
      SumToBill:        chargeAmount.toString(),
      CoinID:           "1",          // ILS
      ProductName:      isTestMode ? `[בדיקה] ${plan.label}` : plan.label,
      GoodURL:            `${appUrl}/api/cardcom/success-redirect?tier=${tier}`,
      SuccessRedirectUrl: `${appUrl}/api/cardcom/success-redirect?tier=${tier}`,
      ErrorURL:           `${appUrl}/payment/error`,
      ErrorRedirectUrl:   `${appUrl}/payment/error`,
      IndicatorURL:     buildIndicatorUrl("/api/cardcom/indicator"),
      UserId:           encodedUserId,
      ShowLogoutButton: "false",
      ...(invoiceEmail ? { Email: invoiceEmail } : {}),
      ...(invoicePhone ? { PhoneNumber: invoicePhone } : {}),
      // ── Automatic invoice ──
      "InvoiceHead.CustName":        business.name || "לקוח פטרה",
      "InvoiceHead.CustAddresLine1": address ?? "",
      "InvoiceHead.SendByEmail":     "true",
      "InvoiceHead.Language":        "he",
      "InvoiceHead.Email":           invoiceEmail,
      "InvoiceHead.Phone":           invoicePhone,
      "InvoiceHead.CoinID":          "1",
      ...(vatNumber ? { "InvoiceHead.CompID": vatNumber } : {}),
      ...(isVatFree ? { "InvoiceHead.ExtIsVatFree": "true" } : {}),
      "InvoiceLines1.Description":   isTestMode ? `[בדיקה] מנוי ${plan.label}` : `מנוי ${plan.label} — חודשי`,
      "InvoiceLines1.Price":         chargeAmount.toString(),
      "InvoiceLines1.Quantity":      "1",
      "InvoiceLines1.IsVat":         isVatFree ? "false" : "true",
    });

    const cardcomRes = await fetch(
      "https://secure.cardcom.solutions/Interface/LowProfile.aspx",
      { method: "POST", body: params }
    );
    const text = await cardcomRes.text();

    // Parse Cardcom's key=value response
    const result: Record<string, string> = {};
    text.split("&").forEach((pair) => {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) return;
      const k = decodeURIComponent(pair.slice(0, eqIdx));
      const v = decodeURIComponent(pair.slice(eqIdx + 1));
      result[k] = v;
    });

    if (result.ResponseCode !== "0") {
      console.error("Cardcom create-payment error:", result);
      return NextResponse.json(
        { error: result.Description ?? "שגיאה ביצירת דף תשלום" },
        { status: 400 }
      );
    }

    // Store the pending code so the success page can activate without needing URL params
    const lpCode = result.LowProfileCode ?? null;
    if (lpCode) {
      await prisma.business.update({
        where: { id: businessId },
        data: { cardcomPendingCode: lpCode },
      });
    }

    return NextResponse.json({ url: result.url ?? lpCode, lowProfileCode: lpCode });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack?.split("\n").slice(0, 3).join(" | ") : "";
    console.error("POST /api/cardcom/create-payment error:", msg, stack);
    return NextResponse.json({ error: "שגיאה ביצירת דף תשלום" }, { status: 500 });
  }
}
