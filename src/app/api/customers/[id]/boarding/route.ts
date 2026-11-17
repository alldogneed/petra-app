export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isGuardError, verticalHiddenResponse } from "@/lib/auth-guards";
import { requireCustomerAccess, callerCan } from "@/lib/customer-access";
import { TENANT_PERMS } from "@/lib/permissions";
import { isModuleHidden } from "@/lib/verticals";
import { listCustomerStays, CUSTOMER_STAYS_MAX } from "@/services/customer-boarding";
import { ServiceError } from "@/services/types";

/**
 * GET /api/customers/[id]/boarding?limit=5..100
 * Boarding stays of one customer (newest first, canceled included) for the customer card.
 * Same CUSTOMERS_PII gate as GET /api/customers/[id]; `paidAmount` only with FINANCE_READ
 * (null otherwise). 404 when the business vertical hides boarding (CLAUDE.md #51).
 * → { stays: [{ id, checkIn, checkOut, status, notes, pet{id,name}, room{id,name}|null, paidAmount|null }],
 *     total, activeCount }
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireCustomerAccess(request, "read");
    if (isGuardError(authResult)) return authResult;
    const { session, businessId } = authResult;

    // /api/customers/* is not a boarding prefix, so requireBusinessAuth doesn't hide it.
    const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { vertical: true } });
    if (isModuleHidden(biz?.vertical, "boarding")) return verticalHiddenResponse();

    const rawLimit = Number(request.nextUrl.searchParams.get("limit"));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), CUSTOMER_STAYS_MAX) : 20;

    const result = await listCustomerStays(businessId, params.id, { limit });
    const canSeeMoney = callerCan(session, businessId, TENANT_PERMS.FINANCE_READ);

    return NextResponse.json({
      stays: result.stays.map((s) => ({ ...s, paidAmount: canSeeMoney ? s.paidAmount : null })),
      total: result.total,
      activeCount: result.activeCount,
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.code === "NOT_FOUND" ? 404 : 400 });
    }
    console.error("Customer boarding GET error:", error);
    return NextResponse.json({ error: "Failed to fetch boarding stays" }, { status: 500 });
  }
}
