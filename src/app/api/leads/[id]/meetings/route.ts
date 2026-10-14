export const dynamic = 'force-dynamic';
/**
 * GET  /api/leads/[id]/meetings — meetings of this lead (newest first)
 * POST /api/leads/[id]/meetings — book a meeting; the lead stays a lead.
 *      Body: { date: "YYYY-MM-DD", startTime: "HH:mm", endTime: "HH:mm", serviceId?, location?, notes? }
 * Auth: VIEW_LEADS (same as the rest of /api/leads/**); businessId from the session.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isGuardError, requireBusinessPermission } from "@/lib/auth-guards";
import { TENANT_PERMS } from "@/lib/permissions";
import { ServiceError } from "@/services/types";
import { createLeadMeeting, listLeadMeetings } from "@/services/lead-meetings";
import { serviceErrorResponse } from "./errors";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireBusinessPermission(request, TENANT_PERMS.VIEW_LEADS);
  if (isGuardError(auth)) return auth;
  try {
    const meetings = await listLeadMeetings(auth.businessId, prisma, params.id);
    return NextResponse.json({ meetings });
  } catch (e) {
    if (e instanceof ServiceError) return serviceErrorResponse(e);
    console.error("GET /api/leads/[id]/meetings error:", e);
    return NextResponse.json({ error: "שגיאה בטעינת הפגישות" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireBusinessPermission(request, TENANT_PERMS.VIEW_LEADS);
  if (isGuardError(auth)) return auth;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const meeting = await createLeadMeeting(auth.businessId, prisma, params.id, {
      date: String(body.date ?? ""),
      startTime: String(body.startTime ?? ""),
      endTime: String(body.endTime ?? ""),
      serviceId: typeof body.serviceId === "string" && body.serviceId ? body.serviceId : null,
      location: typeof body.location === "string" ? body.location : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    }, auth.session.user.id);
    return NextResponse.json({ meeting }, { status: 201 });
  } catch (e) {
    if (e instanceof ServiceError) return serviceErrorResponse(e);
    console.error("POST /api/leads/[id]/meetings error:", e);
    return NextResponse.json({ error: "שגיאה בקביעת הפגישה" }, { status: 500 });
  }
}
