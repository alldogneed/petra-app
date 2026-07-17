export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { scheduleTrainingSessionReminder } from "@/lib/reminder-service";
import { syncTrainingProgramSessionToGcal } from "@/lib/google-calendar";
import { createProgramSession, ServiceError } from "@/services/training";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { sessionDate, durationMinutes, sessionNumber, summary, rating, status,
            practiceItems, nextSessionGoals, homeworkForCustomer, trainerName } = body;

    if (!sessionDate) {
      return NextResponse.json({ error: "sessionDate is required" }, { status: 400 });
    }

    const mins = durationMinutes ? parseInt(durationMinutes) : 60;
    if (!Number.isFinite(mins) || mins < 1 || mins > 1440) {
      return NextResponse.json({ error: "משך מפגש לא תקין (1-1440 דקות)" }, { status: 400 });
    }
    if (sessionNumber) {
      const sn = parseInt(sessionNumber);
      if (!Number.isFinite(sn) || sn < 1) {
        return NextResponse.json({ error: "מספר מפגש לא תקין" }, { status: 400 });
      }
    }
    if (rating) {
      const r = parseInt(rating);
      if (!Number.isFinite(r) || r < 1 || r > 5) {
        return NextResponse.json({ error: "דירוג לא תקין (1-5)" }, { status: 400 });
      }
    }
    const parsedDate = new Date(sessionDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "תאריך לא תקין" }, { status: 400 });
    }
    if (summary && typeof summary === "string" && summary.length > 5000) {
      return NextResponse.json({ error: "סיכום ארוך מדי (מקסימום 5000 תווים)" }, { status: 400 });
    }

    let result;
    try {
      result = await createProgramSession(authResult.businessId, prisma, params.id, {
        sessionDate: parsedDate,
        durationMinutes: mins,
        sessionNumber: sessionNumber ? parseInt(sessionNumber) : null,
        summary: summary || null,
        rating: rating ? parseInt(rating) : null,
        status: status || "COMPLETED",
        practiceItems: practiceItems || null,
        nextSessionGoals: nextSessionGoals || null,
        homeworkForCustomer: homeworkForCustomer || null,
        trainerName: trainerName || null,
      });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Training program not found" }, { status: 404 });
      }
      if (e instanceof ServiceError && e.code === "CONFLICT") {
        return NextResponse.json({ error: e.message }, { status: 409 });
      }
      throw e;
    }

    const { session, program } = result;

    if (program.customer) {
      try {
        await scheduleTrainingSessionReminder({
          sessionId: session.id,
          sessionDate: session.sessionDate,
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

    // Sync to Google Calendar (training sessions previously never reached gcal).
    await syncTrainingProgramSessionToGcal(session.id, authResult.businessId).catch((err) =>
      console.error("syncTrainingProgramSessionToGcal failed (non-critical):", err)
    );

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("POST /api/training-programs/[id]/sessions error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
