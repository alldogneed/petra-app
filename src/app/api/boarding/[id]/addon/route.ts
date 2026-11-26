export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessPermission, isGuardError } from "@/lib/auth-guards";
import { TENANT_PERMS } from "@/lib/permissions";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { addStayAddon } from "@/services/stay-billing";
import { ServiceError } from "@/services/types";

/**
 * POST /api/boarding/[id]/addon { name, unitPrice, quantity?, priceListItemId? } (PAYMENTS_WRITE)
 * Adds an add-on line to the stay's bill — appended to its order while that order is unpaid,
 * otherwise a separate add-on order linked to the stay. → { orderId, appended }
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireBusinessPermission(request, TENANT_PERMS.PAYMENTS_WRITE);
  if (isGuardError(auth)) return auth;
  const rl = rateLimit("api:boarding:addon", auth.businessId, RATE_LIMITS.API_WRITE);
  if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות" }, { status: 429 });
  try {
    const body = await request.json().catch(() => ({}));
    const result = await addStayAddon(auth.businessId, params.id, {
      name: typeof body?.name === "string" ? body.name : "",
      unitPrice: Number(body?.unitPrice),
      quantity: body?.quantity === undefined ? 1 : Number(body.quantity),
      priceListItemId: typeof body?.priceListItemId === "string" ? body.priceListItemId : null,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ServiceError) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "CONFLICT" ? 409 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    console.error("Boarding addon error:", e);
    return NextResponse.json({ error: "Failed to add add-on" }, { status: 500 });
  }
}
