export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { scheduleGroupSessionReminders } from "@/lib/reminder-service";
import { generateGroupSessions, ServiceError } from "@/services/training";

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

    const time = body.time;
    if (time) {
      const [hh, mm] = time.split(":").map((n: string) => parseInt(n, 10));
      if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
        return NextResponse.json({ error: "שעה לא תקינה" }, { status: 400 });
      }
    }

    let startDate: Date | undefined;
    if (body.startDate) {
      startDate = new Date(body.startDate);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json({ error: "תאריך התחלה לא תקין" }, { status: 400 });
      }
    }

    let result;
    try {
      result = await generateGroupSessions(authResult.businessId, prisma, params.id, {
        count,
        startDate,
        time,
      });
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json(
          { error: e.message },
          { status: e.code === "NOT_FOUND" ? 404 : 400 }
        );
      }
      throw e;
    }

    // Schedule reminders for each generated session (awaited — Vercel kills unawaited)
    for (const sessionId of result.created) {
      try {
        await scheduleGroupSessionReminders(sessionId);
      } catch (err) {
        console.error("scheduleGroupSessionReminders (generate) failed (non-critical):", err);
      }
    }

    return NextResponse.json({ created: result.created.length }, { status: 201 });
  } catch (error) {
    console.error("POST generate training sessions error:", error);
    return NextResponse.json({ error: "שגיאה ביצירת סדרת מפגשים" }, { status: 500 });
  }
}
