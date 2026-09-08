export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { isValidTier } from "@/lib/feature-flags";
import { verifyLowProfile, activateVerifiedPayment } from "@/lib/cardcom-activation";

/**
 * POST /api/cardcom/activate-pending
 *
 * Called by the success page after payment. Uses the stored
 * cardcomPendingCode to verify the payment and activate the subscription.
 * Authenticated — requires session cookie.
 *
 * This is the belt-and-braces path: the Cardcom indicator (server-to-server)
 * and the daily reconcile step activate the same payment without needing the
 * customer's browser, so all three share `activateVerifiedPayment`.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId } = authResult;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { cardcomPendingCode: true, tier: true, subscriptionStatus: true },
    });

    if (!business?.cardcomPendingCode) {
      // Nothing pending: either never paid, or the indicator already activated
      // it and cleared the code. Report the latter as success so the success
      // page shows the right state instead of an error.
      if (business?.subscriptionStatus === "active") {
        return NextResponse.json({ ok: true, alreadyActivated: true, tier: business.tier });
      }
      return NextResponse.json({ error: "אין תשלום ממתין" }, { status: 400 });
    }

    // Format: "lowProfileCode::tier"
    const [lowProfileCode, storedTier] = business.cardcomPendingCode.split("::");
    if (!lowProfileCode || !isValidTier(storedTier)) {
      console.error(`activate-pending: malformed pending code for ${businessId}: ${business.cardcomPendingCode}`);
      return NextResponse.json({ error: "מסלול לא תקין" }, { status: 400 });
    }

    const verified = await verifyLowProfile(lowProfileCode);
    if (!verified.ok) {
      console.warn(`activate-pending: not paid (${verified.responseCode}/${verified.dealResponse}) for ${lowProfileCode}`);
      return NextResponse.json({ error: "התשלום לא אושר" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
    const result = await activateVerifiedPayment({
      businessId,
      tier: storedTier,
      lowProfileCode,
      data: verified.data,
      source: "activate-pending",
      ipAddress: ip,
    });

    return NextResponse.json({ ok: true, tier: result.tier, alreadyActivated: result.alreadyActivated });
  } catch (error) {
    console.error("activate-pending error:", error);
    return NextResponse.json({ error: "שגיאה בהפעלת המנוי" }, { status: 500 });
  }
}
