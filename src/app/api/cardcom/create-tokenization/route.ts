export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { isValidTier } from "@/lib/feature-flags";
import { createOwnerLead } from "@/lib/owner-lead";
import { buildIndicatorUrl, validateOrigin, validateInvoiceFields } from "@/lib/security/cardcom-helpers";
import { rateLimitRedis, RL } from "@/lib/security/redis-rate-limiter";

const CARDCOM_PLANS: Record<string, { label: string }> = {
  basic:       { label: "Petra בייסיק — אימות כרטיס לניסיון" },
  pro:         { label: "Petra פרו — אימות כרטיס לניסיון" },
  groomer:     { label: "Petra גרומר+ — אימות כרטיס לניסיון" },
  service_dog: { label: "Petra Service Dog — אימות כרטיס לניסיון" },
};

/**
 * POST /api/cardcom/create-tokenization
 *
 * Creates a Cardcom LowProfile tokenization session (Operation=4 — save card,
 * no immediate charge). Returns the iframe URL to embed in the checkout page.
 *
 * The indicator URL points to /api/cardcom/trial-indicator which saves the
 * token and starts the 14-day trial.
 */
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
    const rl = await rateLimitRedis("cardcom:tokenize", businessId, RL.CARDCOM_AUTH);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי ניסיונות. נסה שוב בעוד מספר דקות." }, { status: 429 });
    }

    const body = await request.json();
    const tier: string = body.tier;
    const { address, vatNumber, businessType, billingEmail } = validateInvoiceFields(body);

    if (!isValidTier(tier) || !(tier in CARDCOM_PLANS)) {
      return NextResponse.json({ error: "מסלול לא תקין" }, { status: 400 });
    }

    const plan = CARDCOM_PLANS[tier];

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { email: true, name: true, phone: true },
    });
    if (!business) {
      return NextResponse.json({ error: "עסק לא נמצא" }, { status: 404 });
    }

    // Save billing fields to Business if provided
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
    const { session } = authResult;
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
    const encodedUserId = `${businessId}::${tier}`;

    const params = new URLSearchParams({
      TerminalNumber:   process.env.CARDCOM_TERMINAL_NUMBER ?? "",
      UserName:         process.env.CARDCOM_API_USERNAME ?? "",
      APILevel:         "10",
      codepage:         "65001",
      Operation:        "4",          // tokenize only — no charge
      Language:         "he",
      SumToBill:        "0",          // ₪0 — card is saved, not charged
      CoinID:           "1",          // ILS
      ProductName:      plan.label,
      GoodURL:            `${appUrl}/payment/trial-success?tier=${tier}`,
      SuccessRedirectUrl: `${appUrl}/payment/trial-success?tier=${tier}`,
      ErrorURL:           `${appUrl}/payment/error`,
      ErrorRedirectUrl:   `${appUrl}/payment/error`,
      IndicatorURL:     buildIndicatorUrl("/api/cardcom/trial-indicator"),
      UserId:           encodedUserId,
      ShowLogoutButton: "false",
      ...(billingEmail ?? business.email ?? undefined ? { Email: (billingEmail ?? business.email)! } : {}),
    });

    const cardcomRes = await fetch(
      "https://secure.cardcom.solutions/Interface/LowProfile.aspx",
      { method: "POST", body: params }
    );
    const text = await cardcomRes.text();

    const result: Record<string, string> = {};
    text.split("&").forEach((pair) => {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) return;
      const k = decodeURIComponent(pair.slice(0, eqIdx));
      const v = decodeURIComponent(pair.slice(eqIdx + 1));
      result[k] = v;
    });

    if (result.ResponseCode !== "0") {
      console.error("Cardcom create-tokenization error:", result);
      return NextResponse.json(
        { error: result.Description ?? "שגיאה ביצירת טופס אימות כרטיס" },
        { status: 400 }
      );
    }

    return NextResponse.json({ url: result.url ?? result.LowProfileCode });
  } catch (error) {
    console.error("POST /api/cardcom/create-tokenization error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת טופס אימות כרטיס" }, { status: 500 });
  }
}
