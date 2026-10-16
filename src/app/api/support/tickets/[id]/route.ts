export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { supportScope } from "@/lib/support-access";
import { getCustomerTicket, ServiceError } from "@/services/support-tickets";

/** One ticket + its handling history, without the Petra team's internal notes. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const scope = supportScope(authResult.session, authResult.businessId);
  try {
    const ticket = await getCustomerTicket(scope, params.id);
    return NextResponse.json({ ...ticket, canReply: scope.canReply });
  } catch (e) {
    if (e instanceof ServiceError && e.code === "NOT_FOUND") return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
