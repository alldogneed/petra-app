export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { GROUP_TYPE_LABELS } from "@/lib/training-groups";
import {
  cancelGroupSessionReminders,
  rescheduleGroupSessionReminders,
} from "@/lib/reminder-service";
import {
  getTrainingGroup,
  updateTrainingGroup,
  deleteTrainingGroup,
  ServiceError,
} from "@/services/training";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    try {
      const group = await getTrainingGroup(authResult.businessId, prisma, params.id);
      return NextResponse.json(group);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "קבוצה לא נמצאה" }, { status: 404 });
      }
      throw e;
    }
  } catch (error) {
    console.error("GET training group error:", error);
    return NextResponse.json({ error: "שגיאה בטעינת קבוצה" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    if (body.groupType !== undefined && !GROUP_TYPE_LABELS[body.groupType]) {
      return NextResponse.json({ error: "סוג קבוצה לא תקין" }, { status: 400 });
    }

    let result;
    try {
      result = await updateTrainingGroup(authResult.businessId, prisma, params.id, body);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "קבוצה לא נמצאה" }, { status: 404 });
      }
      throw e;
    }

    const { group, reminderSettingsChanged, hadReminderEnabled } = result;

    // Resync reminders for upcoming sessions when reminder settings changed
    if (reminderSettingsChanged) {
      try {
        const upcoming = await prisma.trainingGroupSession.findMany({
          where: {
            trainingGroupId: params.id,
            status: "SCHEDULED",
            sessionDatetime: { gt: new Date() },
          },
          select: { id: true },
        });
        for (const s of upcoming) {
          if (group.reminderEnabled) {
            await rescheduleGroupSessionReminders(s.id);
          } else {
            await cancelGroupSessionReminders(s.id);
          }
        }
      } catch (err) {
        console.error("group reminder resync failed (non-critical):", err);
      }
    }

    // Suppress unused variable warning
    void hadReminderEnabled;

    return NextResponse.json(group);
  } catch (error) {
    console.error("PATCH training group error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון קבוצה" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    let sessionIds: string[];
    try {
      ({ sessionIds } = await deleteTrainingGroup(authResult.businessId, prisma, params.id));
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "קבוצה לא נמצאה" }, { status: 404 });
      }
      throw e;
    }

    // Cancel pending reminders (loose relatedEntityId — no FK cascade)
    try {
      for (const id of sessionIds) {
        await cancelGroupSessionReminders(id);
      }
    } catch (err) {
      console.error("cancelGroupSessionReminders (group delete) failed (non-critical):", err);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE training group error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת קבוצה" }, { status: 500 });
  }
}
