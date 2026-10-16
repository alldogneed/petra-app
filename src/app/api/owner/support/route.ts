export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { isSupportTicketStatus } from "@/lib/support-tickets";
import { listStaffTickets } from "@/services/support-tickets";

export async function GET(request: NextRequest) {
  const authResult = await requirePlatformPermission(request, "platform.tenants.read");
  if (isGuardError(authResult)) return authResult;

  const status = new URL(request.url).searchParams.get("status"); // open | in_progress | resolved | null (all)
  if (status && !isSupportTicketStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const result = await listStaffTickets({ status: isSupportTicketStatus(status) ? status : null });
  return NextResponse.json(result);
}
