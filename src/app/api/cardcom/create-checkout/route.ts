export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isValidTier } from "@/lib/feature-flags";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeName } from "@/lib/validation";

const CARDCOM_PLANS: Record<string, { label: string; price: number }> = {
  basic: { label: "Petra Basic",  price: 99  },
  pro:   { label: "Petra Pro",    price: 199 },
};

const RATE_LIMIT_CFG = { max: 5, windowMs: 15 * 60 * 1000 }; // 5 req / 15 min per IP

/**
 * POST /api/cardcom/create-checkout
 *
 * Unauthenticated endpoint — immediate-payment checkout-first flow.
 * 1. Validates name, email, tier, tosAccepted
 * 2. Rejects if email is already registered
 * 3. Creates a PendingCheckout record (expires in 2 hours)
 * 4. Opens a Cardcom LowProfile immediate-charge session (Operation=1, actual plan price)
 *    with UserId = "pending:{checkoutId}::{tier}"
 * 5. Returns { url } for the iframe
 *
 * The checkout-indicator webhook decodes the UserId and, on success,
 * creates the PlatformUser + Business with active subscription and sends login credentials by email.
 */
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const rl = rateLimit("cardcom:create-checkout", ip, RATE_LIMIT_CFG);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "יותר מדי ניסיונות. נסה שוב בעוד מספר דקות." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    const body = await request.json();
    const { name, email, tier, tosAccepted } = body;

    // ── Validate inputs ───────────────────────────────────────────────────────
    const cleanName = sanitizeName(name ?? "");
    if (cleanName.length < 2 || cleanName.length > 100) {
      return NextResponse.json({ error: "נא להזין שם מלא (עד 100 תווים)" }, { status: 400 });
    }
    const emailNorm = (email ?? "").toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNorm)) {
      return NextResponse.json({ error: "כתובת אימייל לא תקינה" }, { status: 400 });
    }
    if (!isValidTier(tier) || !(tier in CARDCOM_PLANS)) {
      return NextResponse.json({ error: "מסלול לא תקין" }, { status: 400 });
    }
    if (!tosAccepted) {
      return NextResponse.json({ error: "יש לאשר את תנאי השימוש" }, { status: 400 });
    }

    // ── Reject if email already registered ───────────────────────────────────
    const existing = await prisma.platformUser.findUnique({
      where: { email: emailNorm },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "כבר קיים חשבון עם אימייל זה. אנא התחבר.", code: "email_exists" },
        { status: 409 }
      );
    }

    // ── Create PendingCheckout (2-hour TTL) ───────────────────────────────────
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const checkout = await prisma.pendingCheckout.create({
      data: {
        name: cleanName,
        email: emailNorm,
        tier,
        tosAccepted: true,
        expiresAt,
      },
    });

    // ── Build Cardcom LowProfile immediate-charge request ─────────────────────
    const plan = CARDCOM_PLANS[tier];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://petra-app.com";

    // UserId encodes the PendingCheckout id so the indicator can retrieve it
    const encodedUserId = `pending:${checkout.id}::${tier}`;

    const params = new URLSearchParams({
      TerminalNumber:   process.env.CARDCOM_TERMINAL_NUMBER ?? "",
      UserName:         process.env.CARDCOM_API_USERNAME ?? "",
      APILevel:         "10",
      codepage:         "65001",
      Operation:        "1",               // immediate charge
      Language:         "he",
      SumToBill:        String(plan.price), // actual plan price
      CoinID:           "1",               // ILS
      ProductName:      plan.label,
      GoodURL:            `${appUrl}/payment/success?tier=${tier}&newuser=1`,
      SuccessRedirectUrl: `${appUrl}/payment/success?tier=${tier}&newuser=1`,
      ErrorURL:           `${appUrl}/payment/error`,
      ErrorRedirectUrl:   `${appUrl}/payment/error`,
      IndicatorURL:     `${appUrl}/api/cardcom/checkout-indicator?secret=${process.env.CARDCOM_WEBHOOK_SECRET ?? ""}`,
      UserId:           encodedUserId,
      ShowLogoutButton: "false",
      Email:            emailNorm,
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
      result[decodeURIComponent(pair.slice(0, eqIdx))] = decodeURIComponent(pair.slice(eqIdx + 1));
    });

    if (result.ResponseCode !== "0") {
      console.error("create-checkout Cardcom error:", result);
      // Clean up the pending record since Cardcom failed
      await prisma.pendingCheckout.delete({ where: { id: checkout.id } }).catch(() => null);
      return NextResponse.json(
        { error: result.Description ?? "שגיאה ביצירת טופס תשלום. נסה שוב." },
        { status: 400 }
      );
    }

    return NextResponse.json({ url: result.url ?? result.LowProfileCode });
  } catch (error) {
    console.error("POST /api/cardcom/create-checkout error:", error);
    return NextResponse.json({ error: "שגיאה בשרת. נסה שוב." }, { status: 500 });
  }
}
