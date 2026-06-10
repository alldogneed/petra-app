export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { scheduleGroupSessionReminders } from "@/lib/reminder-service";

/**
 * POST /api/training-groups/[id]/sessions/generate
 * Bulk-generate recurring weekly sessions from the group's defaultDayOfWeek +
 * defaultTime (or an explicit startDate). Creates attendance rows (NO_SHOW) and
 * schedules WhatsApp reminders for each generated session.
 *
 * Body: { count: number, startDate?: string (YYYY-MM-DD), time?: "HH:mm" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const body = await request.json();
    const count = parseInt(body.count, 10);
    if (!Number.isFinite(count) || count < 1 || count > 52) {
      return NextResponse.json({ error: "מספר מפגשים לא תקין (1-52)" }, { status: 400 });
    }

    // Verify group belongs to this business
    const group = await prisma.trainingGroup.findFirst({
      where: { id: params.id, businessId: authResult.businessId },
    });
    if (!group) {
      return NextResponse.json({ error: "קבוצה לא נמצאה" }, { status: 404 });
    }

    // Resolve the time-of-day (HH:mm)
    const time = body.time || group.defaultTime || "10:00";
    const [hh, mm] = time.split(":").map((n: string) => parseInt(n, 10));
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      return NextResponse.json({ error: "שעה לא תקינה" }, { status: 400 });
    }

    // Resolve the first session date
    let firstDate: Date;
    if (body.startDate) {
      firstDate = new Date(`${body.startDate}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`);
      if (isNaN(firstDate.getTime())) {
        return NextResponse.json({ error: "תאריך התחלה לא תקין" }, { status: 400 });
      }
    } else {
      // Next occurrence of defaultDayOfWeek from today
      if (group.defaultDayOfWeek == null) {
        return NextResponse.json(
          { error: "יש להגדיר יום קבוע לקבוצה או לבחור תאריך התחלה" },
          { status: 400 }
        );
      }
      const now = new Date();
      firstDate = new Date(now);
      firstDate.setHours(hh, mm, 0, 0);
      const dayDiff = (group.defaultDayOfWeek - firstDate.getDay() + 7) % 7;
      firstDate.setDate(firstDate.getDate() + dayDiff);
      // If that lands today but the time already passed, push a week
      if (dayDiff === 0 && firstDate <= now) {
        firstDate.setDate(firstDate.getDate() + 7);
      }
    }

    // Avoid duplicating sessions that already exist on the same datetime
    const existing = await prisma.trainingGroupSession.findMany({
      where: { trainingGroupId: params.id },
      select: { sessionDatetime: true },
    });
    const existingTimes = new Set(existing.map((s) => s.sessionDatetime.getTime()));

    let sessionNumber = await prisma.trainingGroupSession.count({
      where: { trainingGroupId: params.id },
    });

    const participants = await prisma.trainingGroupParticipant.findMany({
      where: { trainingGroupId: params.id, status: "ACTIVE" },
    });

    const created: string[] = [];
    for (let i = 0; i < count; i++) {
      const dt = new Date(firstDate);
      dt.setDate(dt.getDate() + i * 7);
      if (existingTimes.has(dt.getTime())) continue;

      sessionNumber += 1;
      const session = await prisma.trainingGroupSession.create({
        data: {
          trainingGroupId: params.id,
          sessionDatetime: dt,
          sessionNumber,
          status: "SCHEDULED",
        },
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

      // Schedule reminders (awaited — Vercel kills unawaited promises)
      try {
        await scheduleGroupSessionReminders(session.id);
      } catch (err) {
        console.error("scheduleGroupSessionReminders (generate) failed (non-critical):", err);
      }

      created.push(session.id);
    }

    return NextResponse.json({ created: created.length }, { status: 201 });
  } catch (error) {
    console.error("POST generate training sessions error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת סדרת מפגשים" }, { status: 500 });
  }
}
