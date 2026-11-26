export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessPermission, isGuardError } from "@/lib/auth-guards";
import { TENANT_PERMS } from "@/lib/permissions";
import { listLinkableOrders, linkOrderToStay } from "@/services/stay-billing";
import { ServiceError } from "@/services/types";

function errorResponse(e: unknown, fallback: string) {
  if (e instanceof ServiceError) {
    const status = e.code === "NOT_FOUND" ? 404 : e.code === "CONFLICT" ? 409 : 400;
    return NextResponse.json({ error: e.message }, { status });
  }
  console.error(fallback, e);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** GET /api/boarding/[id]/link-order — the stay customer's unlinked orders (FINANCE_READ). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireBusinessPermission(request, TENANT_PERMS.FINANCE_READ);
  if (isGuardError(auth)) return auth;
  try {
    return NextResponse.json({ orders: await listLinkableOrders(auth.businessId, params.id) });
  } catch (e) {
    return errorResponse(e, "Failed to list orders");
  }
}

/** POST /api/boarding/[id]/link-order { orderId } — link an existing order to the stay (PAYMENTS_WRITE). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireBusinessPermission(request, TENANT_PERMS.PAYMENTS_WRITE);
  if (isGuardError(auth)) return auth;
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = typeof body?.orderId === "string" ? body.orderId : "";
    if (!orderId) return NextResponse.json({ error: "חסרה הזמנה" }, { status: 400 });
    return NextResponse.json(await linkOrderToStay(auth.businessId, params.id, orderId));
  } catch (e) {
    return errorResponse(e, "Failed to link order");
  }
}
