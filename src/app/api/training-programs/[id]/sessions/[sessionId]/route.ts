export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import {
  scheduleTrainingSessionReminder,
  cancelTrainingSessionReminder,
} from "@/lib/reminder-service";
import { syncTrainingProgramSessionToGcal, deleteTrainingProgramSessionFromGcal } from "@/lib/google-calendar";
import { updateProgramSession, deleteProgramSession, ServiceError } from "@/services/training";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { sessionDate, durationMinutes, summary, rating,
            practiceItems, nextSessionGoals, homeworkForCustomer, trainerName } = body;

    let parsedDate: Date | undefined;
    if (sessionDate !== undefined) {
      parsedDate = new Date(sessionDate);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: "תאריך לא חוקי" }, { status: 400 });
      }
    }

    let parsedDuration: number | undefined;
    if (durationMinutes !== undefined) {
      const n = parseInt(durationMinutes, 10);
      parsedDuration = Number.isFinite(n) && n > 0 ? n : 60;
    }

    let parsedRating: number | null | undefined;
    if (rating !== undefined) {
      if (rating == null) {
        parsedRating = null;
      } else {
        const r = parseInt(rating, 10);
        if (!Number.isFinite(r) || r < 1 || r > 5) {
          return NextResponse.json({ error: "דירוג חייב להיות בין 1 ל-5" }, { status: 400 });
        }
        parsedRating = r;
      }
    }

    let result;
    try {
      result = await updateProgramSession(authResult.businessId, prisma, params.id, params.sessionId, {
        sessionDate: parsedDate,
        durationMinutes: parsedDuration,
        summary: summary !== undefined ? (summary || null) : undefined,
        rating: parsedRating,
        practiceItems: practiceItems !== undefined ? (practiceItems || null) : undefined,
        nextSessionGoals: nextSessionGoals !== undefined ? (nextSessionGoals || null) : undefined,
        homeworkForCustomer: homeworkForCustomer !== undefined ? (homeworkForCustomer || null) : undefined,
        trainerName: trainerName !== undefined ? (trainerName || null) : undefined,
      });
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
      throw e;
    }

    const { updated, dateChanged, program } = result;

    if (dateChanged && program.customer) {
      try {
        await cancelTrainingSessionReminder(params.sessionId);
        await scheduleTrainingSessionReminder({
          sessionId: updated.id,
          sessionDate: updated.sessionDate,
          businessId: authResult.businessId,
          customerId: program.customer.id,
          customerName: program.customer.name,
          customerPhone: program.customer.phone,
          dogName: program.dog.name,
          programName: program.name,
        });
      } catch (err) {
        console.error("training session reminder reschedule failed (non-critical):", err);
      }
    }

    // Re-sync to Google Calendar (date/time/duration may have changed).
    await syncTrainingProgramSessionToGcal(updated.id, authResult.businessId).catch((err) =>
      console.error("syncTrainingProgramSessionToGcal failed (non-critical):", err)
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/training-programs/[id]/sessions/[sessionId] error:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    // Remove from Google Calendar before deleting the row (needs gcalEventId).
    await deleteTrainingProgramSessionFromGcal(params.sessionId, authResult.businessId).catch((err) =>
      console.error("deleteTrainingProgramSessionFromGcal failed (non-critical):", err)
    );

    let result;
    try {
      result = await deleteProgramSession(authResult.businessId, prisma, params.id, params.sessionId);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
      throw e;
    }

    try {
      await cancelTrainingSessionReminder(result.session.id);
    } catch (err) {
      console.error("cancelTrainingSessionReminder failed (non-critical):", err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/training-programs/[id]/sessions/[sessionId] error:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
