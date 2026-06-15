export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import { scheduleRemindersForNewParticipant } from "@/lib/reminder-service";
import { addGroupParticipant, removeGroupParticipant, ServiceError } from "@/services/training";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { customerId, dogId } = body;

    if (!customerId || !dogId) {
      return NextResponse.json({ error: "customerId and dogId are required" }, { status: 400 });
    }

    let participant;
    try {
      participant = await addGroupParticipant(authResult.businessId, prisma, params.id, { customerId, dogId });
    } catch (e) {
      if (e instanceof ServiceError) {
        return NextResponse.json(
          { error: e.message },
          { status: e.code === "NOT_FOUND" ? 404 : e.code === "CONFLICT" ? 409 : 400 }
        );
      }
      throw e;
    }

    try {
      await scheduleRemindersForNewParticipant(params.id, participant.id);
    } catch (err) {
      console.error("scheduleRemindersForNewParticipant failed (non-critical):", err);
    }

    return NextResponse.json(participant, { status: 201 });
  } catch (error) {
    console.error("POST /api/training-groups/[id]/participants error:", error);
    return NextResponse.json({ error: "Failed to add participant" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireBusinessAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { participantId } = body;

    if (!participantId) {
      return NextResponse.json({ error: "participantId is required" }, { status: 400 });
    }

    try {
      await removeGroupParticipant(authResult.businessId, prisma, participantId);
    } catch (e) {
      if (e instanceof ServiceError && e.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Participant not found" }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/training-groups/[id]/participants error:", error);
    return NextResponse.json({ error: "Failed to remove participant" }, { status: 500 });
  }
}
