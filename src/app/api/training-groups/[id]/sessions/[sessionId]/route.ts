export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import {
  cancelGroupSessionReminders,
  rescheduleGroupSessionReminders,
} from "@/lib/reminder-service";
import { SESSION_STATUS_MAP } from "@/lib/training-groups";
import { syncTrainingGroupSessionToGcal, deleteTrainingGroupSessionFromGcal } from "@/lib/google-calendar";
import { updateGroupSession, deleteGroupSession, ServiceError } from "@/services/training";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    if (body.status !== undefined && !SESSION_STATUS_MAP[body.status]) {
      return NextResponse.json({ error: "סטטוס מפגש לא תקין" }, { status: 400 });
    }

    let newDatetime: Date | undefined;
    if (body.sessionDatetime !== undefined) {
      newDatetime = new Date(body.sessionDatetime);
      if (isNaN(newDatetime.getTime())) {
        return NextResponse.json({ error: "תאריך מפגש לא תקין" }, { status: 400 });
      }
    }

    let result;
    try {
      result = await updateGroupSession(authResult.businessId, prisma, params.id, params.sessionId, {
        status: body.status,
        notes: body.notes,
        sessionDatetime: newDatetime,
      });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "מפגש לא נמצא" }, { status: 404 });
      }
      throw e;
    }

    try {
      if (result.movedToInactive) {
        await cancelGroupSessionReminders(params.sessionId);
      } else if (result.datetimeChanged) {
        await rescheduleGroupSessionReminders(params.sessionId);
      }
    } catch (err) {
      console.error("group reminder sync failed (non-critical):", err);
    }

    // Mirror to Google Calendar: remove if canceled/inactive, otherwise re-sync.
    if (result.movedToInactive) {
      await deleteTrainingGroupSessionFromGcal(params.sessionId, authResult.businessId).catch((err) =>
        console.error("deleteTrainingGroupSessionFromGcal failed (non-critical):", err)
      );
    } else {
      await syncTrainingGroupSessionToGcal(params.sessionId, authResult.businessId).catch((err) =>
        console.error("syncTrainingGroupSessionToGcal failed (non-critical):", err)
      );
    }

    return NextResponse.json(result.session);
  } catch (error) {
    console.error("PATCH training session error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון מפגש" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    // Remove from Google Calendar before deleting the row (needs gcalEventId).
    await deleteTrainingGroupSessionFromGcal(params.sessionId, authResult.businessId).catch((err) =>
      console.error("deleteTrainingGroupSessionFromGcal failed (non-critical):", err)
    );

    try {
      await deleteGroupSession(authResult.businessId, prisma, params.id, params.sessionId);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "מפגש לא נמצא" }, { status: 404 });
      }
      throw e;
    }

    try {
      await cancelGroupSessionReminders(params.sessionId);
    } catch (err) {
      console.error("cancelGroupSessionReminders failed (non-critical):", err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE training session error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת מפגש" }, { status: 500 });
  }
}
