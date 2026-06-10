export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import {
  cancelGroupSessionReminders,
  rescheduleGroupSessionReminders,
} from "@/lib/reminder-service";
import { SESSION_STATUS_MAP } from "@/lib/training-groups";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    // Verify group belongs to this business and session belongs to this group
    const existing = await prisma.trainingGroupSession.findFirst({
      where: {
        id: params.sessionId,
        trainingGroupId: params.id,
        trainingGroup: { businessId: authResult.businessId },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "מפגש לא נמצא" }, { status: 404 });
    }

    // Validate status if provided
    if (body.status !== undefined && !SESSION_STATUS_MAP[body.status]) {
      return NextResponse.json({ error: "סטטוס מפגש לא תקין" }, { status: 400 });
    }

    // Validate datetime if provided
    let newDatetime: Date | undefined;
    if (body.sessionDatetime !== undefined) {
      newDatetime = new Date(body.sessionDatetime);
      if (isNaN(newDatetime.getTime())) {
        return NextResponse.json({ error: "תאריך מפגש לא תקין" }, { status: 400 });
      }
    }

    const session = await prisma.trainingGroupSession.update({
      where: { id: params.sessionId, trainingGroupId: params.id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(newDatetime !== undefined && { sessionDatetime: newDatetime }),
      },
      include: {
        attendance: true,
      },
    });

    // Keep WhatsApp reminders in sync with the session changes.
    // Awaited — Vercel kills unawaited promises.
    try {
      const datetimeChanged =
        newDatetime !== undefined &&
        newDatetime.getTime() !== existing.sessionDatetime.getTime();
      const movedToInactive =
        body.status === "CANCELED" || body.status === "COMPLETED";

      if (movedToInactive) {
        await cancelGroupSessionReminders(params.sessionId);
      } else if (datetimeChanged) {
        await rescheduleGroupSessionReminders(params.sessionId);
      }
    } catch (err) {
      console.error("group reminder sync failed (non-critical):", err);
    }

    return NextResponse.json(session);
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

    // Verify group belongs to this business and session belongs to this group
    const existing = await prisma.trainingGroupSession.findFirst({
      where: {
        id: params.sessionId,
        trainingGroupId: params.id,
        trainingGroup: { businessId: authResult.businessId },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "מפגש לא נמצא" }, { status: 404 });
    }

    // Cancel any pending reminders before deleting (loose relatedEntityId,
    // no FK cascade) so they don't fire for a deleted session.
    try {
      await cancelGroupSessionReminders(params.sessionId);
    } catch (err) {
      console.error("cancelGroupSessionReminders failed (non-critical):", err);
    }

    // Attendance cascades via the session FK (onDelete: Cascade)
    await prisma.trainingGroupSession.delete({
      where: { id: params.sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE training session error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת מפגש" }, { status: 500 });
  }
}
