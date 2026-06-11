export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { scheduleGroupSessionReminders } from "@/lib/reminder-service";
import { SESSION_STATUS_MAP } from "@/lib/training-groups";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();

    // Validate session datetime
    const sessionDatetime = new Date(body.sessionDatetime);
    if (isNaN(sessionDatetime.getTime())) {
      return NextResponse.json({ error: "תאריך מפגש לא תקין" }, { status: 400 });
    }

    // Validate status
    const status = body.status || "SCHEDULED";
    if (!SESSION_STATUS_MAP[status]) {
      return NextResponse.json({ error: "סטטוס מפגש לא תקין" }, { status: 400 });
    }

    // Verify group belongs to this business
    const group = await prisma.trainingGroup.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!group) {
      return NextResponse.json({ error: "Training group not found" }, { status: 404 });
    }

    // Prevent duplicate sessions at the same datetime (matches DB unique constraint)
    const duplicate = await prisma.trainingGroupSession.findFirst({
      where: { trainingGroupId: params.id, sessionDatetime },
    });
    if (duplicate) {
      return NextResponse.json({ error: "כבר קיים מפגש בקבוצה במועד הזה" }, { status: 409 });
    }

    // Get session count for numbering
    const count = await prisma.trainingGroupSession.count({
      where: { trainingGroupId: params.id },
    });

    const session = await prisma.trainingGroupSession.create({
      data: {
        trainingGroupId: params.id,
        sessionDatetime,
        sessionNumber: count + 1,
        status,
        notes: body.notes || null,
      },
      include: {
        attendance: true,
      },
    });

    // Auto-create attendance records for all active participants.
    // Default to NO_SHOW (unmarked) — the trainer marks attendees PRESENT.
    // Defaulting to PRESENT would falsely report 100% attendance for sessions
    // that have not occurred yet.
    const participants = await prisma.trainingGroupParticipant.findMany({
      where: { trainingGroupId: params.id, status: "ACTIVE" },
    });

    if (participants.length > 0) {
      await prisma.trainingGroupAttendance.createMany({
        data: participants.map((p) => ({
          trainingGroupSessionId: session.id,
          participantId: p.id,
          dogId: p.dogId,
          customerId: p.customerId,
          attendanceStatus: "NO_SHOW",
        })),
        skipDuplicates: true,
      });
    }

    // Schedule WhatsApp reminders for active participants (respects the group's
    // reminderEnabled / lead-hours / same-day settings). Must be awaited —
    // Vercel kills unawaited promises before they complete.
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
