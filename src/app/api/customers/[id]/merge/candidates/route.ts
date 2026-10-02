export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isGuardError } from "@/lib/auth-guards";
import { requireCustomerAccess, callerCan } from "@/lib/customer-access";
import { TENANT_PERMS } from "@/lib/permissions";
import { findMergeCandidates, ServiceError } from "@/services/customer-merge";

/**
 * GET /api/customers/[id]/merge/candidates?q=
 * Up to 10 customers of the same business (excluding [id]) to merge into [id].
 * Empty q → same phone / email / name first, then most recent.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireCustomerAccess(request, "write");
    if (isGuardError(authResult)) return authResult;
    if (!callerCan(authResult.session, authResult.businessId, TENANT_PERMS.CRITICAL_DELETE)) {
      return NextResponse.json({ error: "אין לך הרשאה לפעולה זו" }, { status: 403 });
    }
    const { businessId } = authResult;

    const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
    const candidates = await findMergeCandidates(businessId, prisma, params.id, q);
    return NextResponse.json({ candidates });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.code === "NOT_FOUND" ? 404 : 400 });
    }
    console.error("Customer merge candidates error:", error);
    return NextResponse.json({ error: "שגיאה בחיפוש לקוחות" }, { status: 500 });
  }
}
