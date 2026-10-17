export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { validateOrigin } from "@/lib/security/cardcom-helpers";
import { rateLimitRedis, RL } from "@/lib/security/redis-rate-limiter";
import { getPlanPrice } from "@/lib/cardcom-recurring";
import { canUpdateCard } from "@/lib/subscription-billing";
import { startCardUpdate } from "@/lib/cardcom-card-update";

/**
 * POST /api/cardcom/update-card — owner only.
 * Opens a ₪0 Cardcom page that saves a new card for the monthly subscription
 * (see src/lib/cardcom-card-update.ts). Nothing is charged here; the new
 * recurring order bills on the day the paid period ends.
 */
export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "בקשה לא מורשית" }, { status: 403 });
    }
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;
    const { businessId, session } = authResult;

    if (session.impersonatedBusinessId) {
      return NextResponse.json({ error: "לא ניתן לעדכן כרטיס במצב התחזות" }, { status: 403 });
    }
    const isOwner = session.memberships.some((m) => m.businessId === businessId && m.isActive && m.role === "owner");
    if (!isOwner) {
      return NextResponse.json({ error: "רק בעלי העסק יכולים לעדכן את אמצעי התשלום" }, { status: 403 });
    }

    const rl = await rateLimitRedis("cardcom:update-card", businessId, RL.CARDCOM_AUTH);
    if (!rl.allowed) {
      return NextResponse.json({ error: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות." }, { status: 429 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { tier: true, subscriptionStatus: true, email: true },
    });
    if (!business) return NextResponse.json({ error: "עסק לא נמצא" }, { status: 404 });
    if (!canUpdateCard(business)) {
      return NextResponse.json({ error: "אין מנוי פעיל לעדכון כרטיס. לחידוש המנוי עברו לעמוד התשלום." }, { status: 400 });
    }

    const { url } = await startCardUpdate({
      businessId,
      email: business.email,
      tierLabel: getPlanPrice(business.tier)?.label ?? "Petra",
    });
    if (!url) return NextResponse.json({ error: "שגיאה בפתיחת טופס עדכון כרטיס" }, { status: 502 });
    return NextResponse.json({ url });
  } catch (error) {
    console.error("POST /api/cardcom/update-card error:", error);
    return NextResponse.json({ error: "שגיאה בפתיחת טופס עדכון כרטיס" }, { status: 500 });
  }
}
