export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { countAwaitingStaff } from "@/services/support-tickets";

/** Badge on the "תמיכה" menu item: tickets waiting for our answer (+ how many are overdue). */
export async function GET(request: NextRequest) {
  const authResult = await requirePlatformPermission(request, "platform.tenants.read");
  if (isGuardError(authResult)) return authResult;
  return NextResponse.json(await countAwaitingStaff());
}
