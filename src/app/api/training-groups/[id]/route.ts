export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { GROUP_TYPE_LABELS } from "@/lib/training-groups";
import {
  cancelGroupSessionReminders,
  rescheduleGroupSessionReminders,
} from "@/lib/reminder-service";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const group = await prisma.trainingGroup.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: {
        participants: {
          include: {
            dog: true,
            customer: true,
          },
        },
        sessions: {
          orderBy: { sessionDatetime: "desc" },
          include: {
            attendance: {
              include: {
                participant: {
                  include: { dog: true, customer: true },
                },
              },
            },
          },
        },
        _count: {
          select: { participants: true, sessions: true },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "קבוצה לא נמצאה" }, { status: 404 });
    }

    return NextResponse.json(group);
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

    // Verify group belongs to this business
    const existing = await prisma.trainingGroup.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "קבוצה לא נמצאה" }, { status: 404 });
    }

    const body = await request.json();

    if (body.groupType !== undefined && !GROUP_TYPE_LABELS[body.groupType]) {
      return NextResponse.json({ error: "סוג קבוצה לא תקין" }, { status: 400 });
    }

    const group = await prisma.trainingGroup.update({
      where: { id: params.id, businessId: authResult.businessId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.groupType !== undefined && { groupType: body.groupType }),
        ...(body.location !== undefined && { location: body.location }),
        ...(body.defaultDayOfWeek !== undefined && { defaultDayOfWeek: body.defaultDayOfWeek }),
        ...(body.defaultTime !== undefined && { defaultTime: body.defaultTime }),
        ...(body.maxParticipants !== undefined && { maxParticipants: body.maxParticipants }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.reminderEnabled !== undefined && { reminderEnabled: !!body.reminderEnabled }),
        ...(body.reminderLeadHours != null && { reminderLeadHours: body.reminderLeadHours }),
        ...(body.reminderSameDay !== undefined && { reminderSameDay: !!body.reminderSameDay }),
      },
    });

    // If reminder settings changed, resync pending reminders for upcoming sessions.
    const reminderSettingsChanged =
      (body.reminderEnabled !== undefined && !!body.reminderEnabled !== existing.reminderEnabled) ||
      (body.reminderLeadHours != null && body.reminderLeadHours !== existing.reminderLeadHours) ||
      (body.reminderSameDay !== undefined && !!body.reminderSameDay !== existing.reminderSameDay);

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

    const existing = await prisma.trainingGroup.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
      include: { sessions: { select: { id: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "קבוצה לא נמצאה" }, { status: 404 });
    }

    // Cancel pending reminders for every session (loose relatedEntityId — no FK
    // cascade) so they don't fire after the group is deleted.
    try {
      for (const s of existing.sessions) {
        await cancelGroupSessionReminders(s.id);
      }
    } catch (err) {
      console.error("cancelGroupSessionReminders (group delete) failed (non-critical):", err);
    }

    await prisma.trainingGroup.delete({ where: { id: params.id, businessId: authResult.businessId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE training group error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת קבוצה" }, { status: 500 });
  }
}
