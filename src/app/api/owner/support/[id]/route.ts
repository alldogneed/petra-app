export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { isSupportTicketStatus } from "@/lib/support-tickets";
import { getStaffTicket, setStaffTicketStatus, ServiceError } from "@/services/support-tickets";

/** Full ticket + whole handling history (incl. internal notes). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requirePlatformPermission(request, "platform.tenants.read");
  if (isGuardError(authResult)) return authResult;
  try {
    return NextResponse.json(await getStaffTicket(params.id));
  } catch (e) {
    if (e instanceof ServiceError && e.code === "NOT_FOUND") return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requirePlatformPermission(request, "platform.tenants.write");
  if (isGuardError(authResult)) return authResult;

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isSupportTicketStatus(body.status)) {
    return NextResponse.json({ error: "סטטוס לא חוקי" }, { status: 400 });
  }

  const { user } = authResult.session;
  try {
    const updated = await setStaffTicketStatus(params.id, body.status, { userId: user.id, name: user.name ?? null });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof ServiceError && e.code === "NOT_FOUND") return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    throw e;
  }
}
