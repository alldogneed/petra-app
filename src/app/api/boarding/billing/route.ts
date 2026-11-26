export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessPermission, isGuardError } from "@/lib/auth-guards";
import { TENANT_PERMS } from "@/lib/permissions";
import { getStaysBilling, STAY_BILLING_MAX_IDS } from "@/services/stay-billing";

/**
 * GET /api/boarding/billing?ids=a,b,c — per-stay billing (FINANCE_READ).
 * → { billing: { [stayId]: { orderId, orderCount, total|null, paid, pending, balance|null } } }
 * Ids that are not this business's stays are left out. Orders are created with POST /api/orders
 * (relatedEntityType "BoardingStay"), payments with POST /api/payments (orderId + boardingStayId).
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireBusinessPermission(request, TENANT_PERMS.FINANCE_READ);
    if (isGuardError(authResult)) return authResult;
    const raw = request.nextUrl.searchParams.get("ids") ?? "";
    const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length > STAY_BILLING_MAX_IDS) {
      return NextResponse.json({ error: `מקסימום ${STAY_BILLING_MAX_IDS} שהיות בבקשה` }, { status: 400 });
    }
    const billing = await getStaysBilling(authResult.businessId, ids);
    return NextResponse.json({ billing });
  } catch (error) {
    console.error("Boarding billing GET error:", error);
    return NextResponse.json({ error: "Failed to fetch billing" }, { status: 500 });
  }
}
