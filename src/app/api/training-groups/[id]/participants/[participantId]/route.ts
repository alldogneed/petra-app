export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { scheduleRemindersForNewParticipant } from "@/lib/reminder-service";
import { promoteGroupParticipant, ServiceError } from "@/services/training";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// PATCH /api/training-groups/[id]/participants/[participantId]
// Body: { action: "promote" } — promote a WAITLIST participant to ACTIVE.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; participantId: string } }
) {
  try {
    const authResult = await requireBusinessAuth(request);
    if (isGuardError(authResult)) return authResult;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit("api:training-groups:promote", ip, RATE_LIMITS.API_WRITE);
    if (!rl.allowed) return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });

    const body = await request.json().catch(() => ({}));
    if (body.action !== "promote") {
      return NextResponse.json({ error: "פעולה לא נתמכת" }, { status: 400 });
    }

    let participant;
    try {
      participant = await promoteGroupParticipant(
        authResult.businessId,
        prisma,
        params.participantId,
        params.id
      );
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json(
          { error: e.message },
          { status: e.code === "NOT_FOUND" ? 404 : e.code === "CONFLICT" ? 409 : 400 }
        );
      }
      throw e;
    }

    // Newly-ACTIVE participant should get session reminders like a fresh joiner.
    // Use the participant's REAL group id — never the URL segment (cross-tenant risk).
    try {
      await scheduleRemindersForNewParticipant(participant.trainingGroupId, participant.id);
    } catch (err) {
      console.error("scheduleRemindersForNewParticipant (promote) failed (non-critical):", err);
    }

    return NextResponse.json(participant);
  } catch (error) {
    console.error("PATCH /api/training-groups/[id]/participants/[participantId] error:", error);
    return NextResponse.json({ error: "שגיאה בקידום משתתף" }, { status: 500 });
  }
}
