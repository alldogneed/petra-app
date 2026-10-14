export const dynamic = 'force-dynamic';
/**
 * PATCH  /api/leads/[id]/meetings/[meetingId] — move / edit a scheduled meeting ("נדחתה");
 *        the reminder moves with it. Body: any of { date, startTime, endTime, serviceId, location, notes }
 * DELETE /api/leads/[id]/meetings/[meetingId] — cancel the meeting (and its reminder).
 * Auth: VIEW_LEADS; meeting must belong to this lead AND this business.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isGuardError, requireBusinessPermission } from "@/lib/auth-guards";
import { TENANT_PERMS } from "@/lib/permissions";
import { ServiceError } from "@/services/types";
import { cancelLeadMeeting, updateLeadMeeting, type LeadMeetingInput } from "@/services/lead-meetings";
import { serviceErrorResponse } from "../errors";

type Params = { params: { id: string; meetingId: string } };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireBusinessPermission(request, TENANT_PERMS.VIEW_LEADS);
  if (isGuardError(auth)) return auth;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const input: Partial<LeadMeetingInput> = {};
  for (const k of ["date", "startTime", "endTime"] as const) {
    if (typeof body[k] === "string") input[k] = body[k];
  }
  if ("serviceId" in body) input.serviceId = typeof body.serviceId === "string" && body.serviceId ? body.serviceId : null;
  if ("location" in body) input.location = typeof body.location === "string" ? body.location : null;
  if ("notes" in body) input.notes = typeof body.notes === "string" ? body.notes : null;

  try {
    const meeting = await updateLeadMeeting(auth.businessId, prisma, params.id, params.meetingId, input);
    return NextResponse.json({ meeting });
  } catch (e) {
    if (e instanceof ServiceError) return serviceErrorResponse(e);
    console.error("PATCH lead meeting error:", e);
    return NextResponse.json({ error: "שגיאה בעדכון הפגישה" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireBusinessPermission(request, TENANT_PERMS.VIEW_LEADS);
  if (isGuardError(auth)) return auth;
  try {
    return NextResponse.json(await cancelLeadMeeting(auth.businessId, prisma, params.id, params.meetingId));
  } catch (e) {
    if (e instanceof ServiceError) return serviceErrorResponse(e);
    console.error("DELETE lead meeting error:", e);
    return NextResponse.json({ error: "שגיאה בביטול הפגישה" }, { status: 500 });
  }
}
