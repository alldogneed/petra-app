export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission, isGuardError } from "@/lib/auth-guards";
import { isSupportTicketStatus, validateSupportReply } from "@/lib/support-tickets";
import { addStaffMessage, ServiceError } from "@/services/support-tickets";

/**
 * POST { body, internal?: boolean, status?: "open"|"in_progress"|"resolved" }
 * internal=false → reply to the customer (email + in-app message); true → staff-only note.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requirePlatformPermission(request, "platform.tenants.write");
  if (isGuardError(authResult)) return authResult;

  let raw: { body?: unknown; internal?: unknown; status?: unknown };
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const v = validateSupportReply(raw.body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  if (raw.status != null && !isSupportTicketStatus(raw.status)) {
    return NextResponse.json({ error: "סטטוס לא חוקי" }, { status: 400 });
  }

  const { user } = authResult.session;
  try {
    const result = await addStaffMessage(
      params.id,
      { userId: user.id, name: user.name ?? null },
      { body: v.body, internal: raw.internal === true, status: isSupportTicketStatus(raw.status) ? raw.status : null }
    );
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof ServiceError && e.code === "NOT_FOUND") return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
