export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { supportScope } from "@/lib/support-access";
import { listCustomerTickets } from "@/services/support-tickets";

/** "הפניות שלי" — the member's tickets (the owner sees all of the business). */
export async function GET(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const scope = supportScope(authResult.session, authResult.businessId);
  return NextResponse.json(await listCustomerTickets(scope));
}
