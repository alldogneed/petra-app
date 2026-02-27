export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/auth-guards";

// POST /api/training-groups/[id]/participants – add a participant to the group
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { customerId, dogId } = body;

    if (!customerId || !dogId) {
      return NextResponse.json({ error: "customerId and dogId are required" }, { status: 400 });
    }

    // Check if already enrolled
    const existing = await prisma.trainingGroupParticipant.findUnique({
      where: {
        trainingGroupId_dogId: {
          trainingGroupId: params.id,
          dogId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Dog is already enrolled in this group" }, { status: 409 });
    }

    // Check max participants
    const group = await prisma.trainingGroup.findUnique({
      where: { id: params.id },
      select: { maxParticipants: true, _count: { select: { participants: true } } },
    });

    if (group?.maxParticipants && group._count.participants >= group.maxParticipants) {
      return NextResponse.json({ error: "Group is full" }, { status: 400 });
    }

    const participant = await prisma.trainingGroupParticipant.create({
      data: {
        trainingGroupId: params.id,
        customerId,
        dogId,
      },
      include: {
        dog: { select: { id: true, name: true, species: true, breed: true } },
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    return NextResponse.json(participant, { status: 201 });
  } catch (error) {
    console.error("POST /api/training-groups/[id]/participants error:", error);
    return NextResponse.json({ error: "Failed to add participant" }, { status: 500 });
  }
}

// DELETE /api/training-groups/[id]/participants – remove participant (pass participantId in body)
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (isGuardError(authResult)) return authResult;

    const body = await req.json();
    const { participantId } = body;

    if (!participantId) {
      return NextResponse.json({ error: "participantId is required" }, { status: 400 });
    }

    await prisma.trainingGroupParticipant.delete({
      where: { id: participantId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/training-groups/[id]/participants error:", error);
    return NextResponse.json({ error: "Failed to remove participant" }, { status: 500 });
  }
}
