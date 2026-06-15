export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { scheduleGroupSessionReminders } from "@/lib/reminder-service";
import { SESSION_STATUS_MAP } from "@/lib/training-groups";
import { createGroupSession, ServiceError } from "@/services/training";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    const sessionDatetime = new Date(body.sessionDatetime);
    if (isNaN(sessionDatetime.getTime())) {
      return NextResponse.json({ error: "תאריך מפגש לא תקין" }, { status: 400 });
    }

    const status = body.status || "SCHEDULED";
    if (!SESSION_STATUS_MAP[status]) {
      return NextResponse.json({ error: "סטטוס מפגש לא תקין" }, { status: 400 });
    }

    let session;
    try {
      session = await createGroupSession(authResult.businessId, prisma, params.id, {
        sessionDatetime,
        status,
        notes: body.notes || null,
      });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Training group not found" }, { status: 404 });
      }
      if (e instanceof ServiceError && e.code === "CONFLICT") {
        return NextResponse.json({ error: e.message }, { status: 409 });
      }
      throw e;
    }

    try {
      await scheduleGroupSessionReminders(session.id);
    } catch (err) {
      console.error("scheduleGroupSessionReminders failed (non-critical):", err);
    }

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("POST training session error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת מפגש" }, { status: 500 });
  }
}
