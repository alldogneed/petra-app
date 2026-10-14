export const dynamic = 'force-dynamic';
/**
 * POST /api/leads/[id]/meetings/[meetingId]/outcome
 * Body: { outcome: "completed" | "no_show", followUpAt?: ISO string }
 * - completed → the lead becomes a customer + a completed appointment is recorded.
 *   Returns { customer: { id, name }, appointmentId } for navigation.
 * - no_show  → the lead stays a lead with a follow-up date.
 * Auth: VIEW_LEADS; meeting must belong to this lead AND this business.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isGuardError, requireBusinessPermission } from "@/lib/auth-guards";
import { TENANT_PERMS } from "@/lib/permissions";
import { ServiceError } from "@/services/types";
import { recordLeadMeetingOutcome } from "@/services/lead-meetings";
import { LEAD_MEETING_OUTCOMES, type LeadMeetingOutcome } from "@/lib/lead-meetings";
import { serviceErrorResponse } from "../../errors";

export async function POST(request: NextRequest, { params }: { params: { id: string; meetingId: string } }) {
  const auth = await requireBusinessPermission(request, TENANT_PERMS.VIEW_LEADS);
  if (isGuardError(auth)) return auth;
  const body = await request.json().catch(() => null);
  const outcome = body?.outcome;
  if (!(LEAD_MEETING_OUTCOMES as readonly string[]).includes(outcome)) {
    return NextResponse.json({ error: "outcome חייב להיות completed או no_show" }, { status: 400 });
  }
  try {
    const result = await recordLeadMeetingOutcome(
      auth.businessId, prisma, params.id, params.meetingId, outcome as LeadMeetingOutcome, auth.session.user.id,
      { followUpAt: typeof body.followUpAt === "string" ? body.followUpAt : null },
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ServiceError) return serviceErrorResponse(e);
    console.error("POST lead meeting outcome error:", e);
    return NextResponse.json({ error: "שגיאה בשמירת תוצאת הפגישה" }, { status: 500 });
  }
}
