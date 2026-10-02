export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isGuardError } from "@/lib/auth-guards";
import { requireCustomerAccess, callerCan } from "@/lib/customer-access";
import { TENANT_PERMS } from "@/lib/permissions";
import { clampTake, parseCursor } from "@/lib/customer-summary";
import { listCustomerPayments } from "@/services/customer-detail";
import { ServiceError } from "@/services/types";

/**
 * GET /api/customers/[id]/payments?cursor=<paymentId>&take=20
 * Customer read + FINANCE_READ (overrides honoured).
 * → { payments: [customer.payments item shape], nextCursor: string|null, total: number } (newest first)
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireCustomerAccess(request, "read");
    if (isGuardError(authResult)) return authResult;
    if (!callerCan(authResult.session, authResult.businessId, TENANT_PERMS.FINANCE_READ)) {
      return NextResponse.json({ error: "אין הרשאה לצפות בתשלומים" }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const rawCursor = sp.get("cursor");
    const cursor = parseCursor(rawCursor);
    if (rawCursor && !cursor) return NextResponse.json({ error: "cursor לא תקין" }, { status: 400 });
    const take = clampTake(sp.get("take"), 20, 50);

    const page = await listCustomerPayments(authResult.businessId, prisma, params.id, { cursor, take });
    return NextResponse.json({ payments: page.items, nextCursor: page.nextCursor, total: page.total });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.code === "NOT_FOUND" ? 404 : 400 });
    }
    console.error("Customer payments GET error:", error);
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}
