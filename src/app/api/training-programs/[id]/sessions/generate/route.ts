export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { scheduleTrainingSessionReminder } from "@/lib/reminder-service";
import { syncTrainingProgramSessionToGcal } from "@/lib/google-calendar";
import { generateProgramSessions, ServiceError } from "@/services/training";

/**
 * POST /api/training-programs/[id]/sessions/generate
 * Create a recurring series of SCHEDULED sessions for an individual program.
 * Body: { count, startDate (ISO), durationMinutes?, intervalDays? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();

    const count = parseInt(body.count, 10);
    if (!Number.isFinite(count) || count < 1 || count > 52) {
      return NextResponse.json({ error: "מספר מפגשים לא תקין (1-52)" }, { status: 400 });
    }

    if (!body.startDate) {
      return NextResponse.json({ error: "תאריך התחלה נדרש" }, { status: 400 });
    }
    const startDate = new Date(body.startDate);
    if (isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "תאריך התחלה לא תקין" }, { status: 400 });
    }

    const mins = body.durationMinutes ? parseInt(body.durationMinutes, 10) : 60;
    if (!Number.isFinite(mins) || mins < 1 || mins > 1440) {
      return NextResponse.json({ error: "משך מפגש לא תקין (1-1440 דקות)" }, { status: 400 });
    }

    const intervalDays = body.intervalDays ? parseInt(body.intervalDays, 10) : 7;
    if (!Number.isFinite(intervalDays) || intervalDays < 1 || intervalDays > 90) {
      return NextResponse.json({ error: "מרווח ימים לא תקין" }, { status: 400 });
    }

    let result;
    try {
      result = await generateProgramSessions(authResult.businessId, prisma, params.id, {
        count,
        startDate,
        durationMinutes: mins,
        intervalDays,
      });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Training program not found" }, { status: 404 });
      }
      throw e;
    }

    const { created, program } = result;

    // Schedule a WhatsApp reminder per created session (non-critical)
    if (program.customer) {
      for (const s of created) {
        try {
          await scheduleTrainingSessionReminder({
            sessionId: s.id,
            sessionDate: s.sessionDate,
            businessId: authResult.businessId,
            customerId: program.customer.id,
            customerName: program.customer.name,
            customerPhone: program.customer.phone,
            dogName: program.dog.name,
            programName: program.name,
          });
        } catch (err) {
          console.error("scheduleTrainingSessionReminder failed (non-critical):", err);
        }
      }
    }

    // Sync each generated session to Google Calendar (non-critical, per session).
    for (const s of created) {
      await syncTrainingProgramSessionToGcal(s.id, authResult.businessId).catch((err) =>
        console.error("syncTrainingProgramSessionToGcal failed (non-critical):", err)
      );
    }

    return NextResponse.json({ created: created.length }, { status: 201 });
  } catch (error) {
    console.error("POST /api/training-programs/[id]/sessions/generate error:", error);
    return NextResponse.json({ error: "Failed to generate sessions" }, { status: 500 });
  }
}
