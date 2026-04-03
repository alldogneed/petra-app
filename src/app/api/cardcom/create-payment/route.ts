export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { isValidTier, type TierKey } from "@/lib/feature-flags";
import { createOwnerLead } from "@/lib/owner-lead";

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

    const body = await request.json();
    const tier: string = body.tier;
    const address: string | undefined = body.address?.trim() || undefined;
    const vatNumber: string | undefined = body.vatNumber?.trim() || undefined;
    const businessType: string | undefined = body.businessType?.trim() || undefined;
    const billingEmail: string | undefined = body.billingEmail?.toLowerCase().trim() || undefined;

    if (!isValidTier(tier) || !(tier in CARDCOM_PLANS)) {
      return NextResponse.json({ error: "מסלול לא תקין" }, { status: 400 });
    }

    const plan = CARDCOM_PLANS[tier];

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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://petra-app.vercel.app";

    // Encode businessId + tier into UserId so indicator can read both back
    const encodedUserId = `${businessId}::${tier}`;

    const params = new URLSearchParams({
      TerminalNumber:   process.env.CARDCOM_TERMINAL_NUMBER ?? "",
      UserName:         process.env.CARDCOM_API_USERNAME ?? "",
      APILevel:         "10",
      codepage:         "65001",
      Operation:        "1",          // charge
      Language:         "he",
      SumToBill:        plan.price.toString(),
      CoinID:           "1",          // ILS
      ProductName:      plan.label,
      GoodURL:            `${appUrl}/payment/success?tier=${tier}`,
      SuccessRedirectUrl: `${appUrl}/payment/success?tier=${tier}`,
      ErrorURL:           `${appUrl}/payment/error`,
      ErrorRedirectUrl:   `${appUrl}/payment/error`,
      IndicatorURL:     `${appUrl}/api/cardcom/indicator?secret=${process.env.CARDCOM_WEBHOOK_SECRET ?? ""}`,
      UserId:           encodedUserId,
      ShowLogoutButton: "false",
      ...(billingEmail ?? business.email ?? undefined ? { Email: (billingEmail ?? business.email)! } : {}),
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

    return NextResponse.json({ url: result.url ?? result.LowProfileCode });
  } catch (error) {
    console.error("POST /api/cardcom/create-payment error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת דף תשלום" }, { status: 500 });
  }
}
